import { CryptoManager } from './CryptoManager.js';
import { GistTransport } from './GistTransport.js';
import { GistAPI } from './GistAPI.js';
import { LocalCacheAdapter } from './LocalCacheAdapter.js';
import { ConflictResolver } from './ConflictResolver.js';
import { KeyVault } from './KeyVault.js';
import { GistDBError } from './errors.js';

export class GistDB {
  #crypto = null;
  #transport = null;
  #cache = null;
  #resolver = null;
  #prefix = '';
  #gistId = null;
  #watchers = new Map();
  #pollIntervals = new Map();

  constructor() {
    // Use GistDB.create() — não instancie diretamente
  }

  /**
   * Factory assíncrono. Único ponto de entrada público.
   * @param {object} options
   * @param {string} options.token        - GitHub Personal Access Token
   * @param {string} options.prefix       - Prefixo único do projeto (ex: 'myapp')
   * @param {string} [options.gistId]     - ID de um Gist existente (opcional)
   * @param {string} [options.encryptionKey] - Senha para criptografar dados
   * @param {object} [options.schema]     - Mapa { collection: validatorFn }
   * @param {string} [options.conflict]   - 'last-write-wins'|'remote-wins'|'local-wins'
   * @param {number} [options.cacheTTL]   - TTL do cache local em ms (padrão: 5min)
   */
  static async create({
    token,
    prefix,
    gistId = null,
    encryptionKey = null,
    schema = {},
    conflict = 'last-write-wins',
    cacheTTL = 5 * 60 * 1000,
  } = {}) {
    if (!token)
      throw new GistDBError('TOKEN_REQUIRED', 'Forneça um GitHub token.');
    if (!prefix)
      throw new GistDBError('PREFIX_REQUIRED', 'Forneça um prefix único.');

    const db = new GistDB();
    db.#prefix = prefix;
    db.#gistId = gistId;

    KeyVault.store(token);

    if (encryptionKey) {
      db.#crypto = await CryptoManager.fromPassword(encryptionKey);
    }

    const api = new GistAPI(KeyVault.retrieve, prefix);
    db.#transport = new GistTransport(api);
    db.#cache = new LocalCacheAdapter({ ttl: cacheTTL, prefix });
    db.#resolver = new ConflictResolver(conflict);
    db.#schema = schema;

    if (!gistId) {
      db.#gistId = await db.#transport.initGist();
    }

    db.#transport.setGistId(db.#gistId);
    return db;
  }

  // ─── CRUD ────────────────────────────────────────────────────

  async get(collection, id) {
    this.#assertReady();
    const cacheKey = this.#key(collection, id);

    const cached = await this.#cache.read(cacheKey);
    if (cached) return cached.data;

    const raw = await this.#transport.getFile(this.#filename(collection, id));
    if (!raw) return null;

    const data = await this.#maybeDecrypt(raw);
    await this.#cache.write(cacheKey, data, raw._version);
    return data;
  }

  async set(collection, id, data) {
    this.#assertReady();
    this.#validate(collection, data);

    const existing = await this.get(collection, id).catch(() => null);
    const version = this.#nextVersion(existing?._version);
    const payload = {
      ...data,
      _id: id,
      _version: version,
      _updatedAt: new Date().toISOString(),
    };

    const remote = await this.#transport.getFile(
      this.#filename(collection, id),
    );
    const resolved = remote
      ? this.#resolver.resolve(payload, await this.#maybeDecrypt(remote), {
          version,
        })
      : payload;

    const toWrite = await this.#maybeEncrypt(resolved);
    await this.#transport.putFile(this.#filename(collection, id), toWrite);
    await this.#cache.write(this.#key(collection, id), resolved, version);

    this.#notifyWatchers(collection, id, resolved);
    return { id, version, updatedAt: resolved._updatedAt };
  }

  async delete(collection, id) {
    this.#assertReady();
    await this.#transport.deleteFile(this.#filename(collection, id));
    await this.#cache.invalidate(this.#key(collection, id));
    this.#notifyWatchers(collection, id, null);
    return true;
  }

  async list(collection, filterFn = null) {
    this.#assertReady();
    const files = await this.#transport.listFiles(collection);
    const results = await Promise.all(
      files.map(async (f) => {
        const data = await this.#maybeDecrypt(f);
        return data;
      }),
    );
    return filterFn ? results.filter(filterFn) : results;
  }

  // ─── SYNC ────────────────────────────────────────────────────

  async sync() {
    this.#assertReady();
    await this.#cache.clear();
    await this.#transport.flushQueue();
    return { syncedAt: new Date().toISOString() };
  }

  async getLastSyncAt() {
    const meta = await this.#cache.read(`${this.#prefix}:__meta__`);
    return meta?.data?.lastSyncAt ?? null;
  }

  /**
   * Observa mudanças em uma collection via polling.
   * @param {string} collection
   * @param {function} callback   - (id, newData) => void
   * @param {number}  [interval]  - ms entre checks (padrão: 30s)
   */
  watch(collection, callback, interval = 30_000) {
    if (!this.#watchers.has(collection)) {
      this.#watchers.set(collection, new Set());
    }
    this.#watchers.get(collection).add(callback);

    if (!this.#pollIntervals.has(collection)) {
      const timer = setInterval(
        () => this.#pollCollection(collection),
        interval,
      );
      this.#pollIntervals.set(collection, timer);
    }

    return () => this.#unwatch(collection, callback);
  }

  destroy() {
    this.#pollIntervals.forEach((t) => clearInterval(t));
    this.#pollIntervals.clear();
    this.#watchers.clear();
    KeyVault.clear();
  }

  // ─── INTERNOS ────────────────────────────────────────────────

  #key(collection, id) {
    return `${this.#prefix}:${collection}:${id}`;
  }

  #filename(collection, id) {
    return `gistdb_${this.#prefix}_${collection}_${id}.json`;
  }

  #nextVersion(current) {
    const n = parseInt(current?.split('v')[1] ?? '0', 10);
    return `v${n + 1}`;
  }

  async #maybeEncrypt(data) {
    if (!this.#crypto) return data;
    return this.#crypto.encrypt(data);
  }

  async #maybeDecrypt(data) {
    if (!this.#crypto) return data;
    return this.#crypto.decrypt(data);
  }

  #validate(collection, data) {
    const validator = this.#schema?.[collection];
    if (validator && !validator(data)) {
      throw new GistDBError(
        'VALIDATION_ERROR',
        `Dados inválidos para collection "${collection}".`,
      );
    }
  }

  #assertReady() {
    if (!this.#gistId)
      throw new GistDBError('NOT_INITIALIZED', 'GistDB não inicializado.');
  }

  async #pollCollection(collection) {
    const files = await this.#transport.listFiles(collection).catch(() => []);
    for (const f of files) {
      const data = await this.#maybeDecrypt(f);
      const cached = await this.#cache.read(this.#key(collection, data._id));
      if (cached?.version !== data._version) {
        await this.#cache.write(
          this.#key(collection, data._id),
          data,
          data._version,
        );
        this.#notifyWatchers(collection, data._id, data);
      }
    }
  }

  #notifyWatchers(collection, id, data) {
    const callbacks = this.#watchers.get(collection);
    if (!callbacks) return;
    callbacks.forEach((cb) => cb(id, data));
  }
}
