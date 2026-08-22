// @ts-ignore
import { CryptoManager } from './CryptoManager.js';
import { GistTransport } from './GistTransport.js';
// @ts-ignore
import { GistAPI } from './GistAPI.js';
import { LocalCacheAdapter } from './LocalCacheAdapter.js';
// @ts-ignore
import { ConflictResolver } from './ConflictResolver.js';
// @ts-ignore
import { KeyVault } from './KeyVault.js';
import { GistDBError } from './errors.js';
import { DeviceIdentity } from './DeviceIdentity.js';
import { DeviceInfo } from './types.js';
import { Logger } from './Logger.js';


export class GistDB {
  #crypto: any = null;
  #transport: GistTransport | null = null;
  #cache: LocalCacheAdapter | null = null;
  #resolver: any = null;
  #password: string | null = null;
  #prefix = '';
  #gistId: string | null = null;
  #watchers = new Map<string, Set<(id: string, data: any) => void>>();
  #pollIntervals = new Map<string, any>();
  #schema: Record<string, (data: any) => boolean> = {};
  #deviceInfo: DeviceInfo | null = null;
  #autoSyncCleanups: Array<() => void> = [];

  constructor() {
    // Use GistDB.create() — não instancie diretamente
  }

  get deviceId(): string {
    return this.#deviceInfo?.id || '';
  }

  get devices() {
    return {
      list: async (): Promise<DeviceInfo[]> => {
        this.#assertReady();
        const list = await this.list('__devices__').catch(() => []);
        return list.map((dev: any) => ({
          id: dev._id || dev.id,
          name: dev.name,
          platform: dev.platform,
          lastSeenAt: dev.lastSeenAt || dev._updatedAt,
          isCurrent: dev._id === this.deviceId || dev.id === this.deviceId,
        }));
      },
    };
  }

  /**
   * Factory assíncrono. Único ponto de entrada público.
   */
  static async create({
    token,
    prefix,
    gistId = null,
    password = undefined,
    schema = {},
    conflictResolver = 'last-write-wins',
    ttl = 5 * 60 * 1000,
    autoConnect = true,
    autoSync = false,
    deviceName = undefined,
  }: {
    token: string;
    prefix: string;
    gistId?: string | null;
    password?: string;
    schema?: Record<string, (data: any) => boolean>;
    conflictResolver?:
      | 'last-write-wins'
      | 'merge'
      | ((local: any, remote: any) => any);
    ttl?: number;
    autoConnect?: boolean;
    autoSync?:
      | boolean
      | {
          onFocus?: boolean;
          onReconnect?: boolean;
          onUnload?: boolean;
        };
    deviceName?: string;
  }): Promise<GistDB> {
    if (!token)
      throw new GistDBError('TOKEN_REQUIRED', 'Forneça um GitHub token.');
    if (!prefix)
      throw new GistDBError('PREFIX_REQUIRED', 'Forneça um prefix único.');

    const db = new GistDB();
    db.#prefix = prefix;
    db.#gistId = gistId;
    db.#deviceInfo = DeviceIdentity.getDeviceInfo(deviceName);

    KeyVault.store(token);

    if (password) {
      db.#crypto = await CryptoManager.fromPassword(password);
      db.#password = password;
    }

    const api = new GistAPI(KeyVault.retrieve, prefix);
    db.#transport = new GistTransport(api);
    db.#cache = new LocalCacheAdapter({ ttl, prefix });
    db.#resolver = new ConflictResolver(conflictResolver);
    db.#schema = schema;

    if (!gistId) {
      db.#gistId = await db.#transport.initGist(autoConnect);
    }

    db.#transport.setGistId(db.#gistId!);

    db.#setupAutoSync(autoSync);

    // Registo silencioso do dispositivo na collection reservada __devices__
    await db.set('__devices__', db.#deviceInfo.id, {
      name: db.#deviceInfo.name,
      platform: db.#deviceInfo.platform,
      lastSeenAt: db.#deviceInfo.lastSeenAt,
    }).catch(() => {});

    return db;
  }

  // ─── CRUD ────────────────────────────────────────────────────

  async get(collection: string, id: string): Promise<any> {
    this.#assertReady();
    const traceId = Logger.createTraceId();
    const startTime = Date.now();
    Logger.debug('GistDB', `get() initiated for ${collection}/${id}`, undefined, traceId);

    const cacheKey = this.#key(collection, id);

    const cached = await this.#cache!.read(cacheKey);
    if (cached) {
      const durationMs = Date.now() - startTime;
      Logger.info('GistDB', `get() resolved via cache for ${collection}/${id}`, { durationMs, fromCache: true }, traceId);
      return cached.data;
    }

    const raw = await this.#transport!.getFile(this.#filename(collection, id));
    if (!raw) {
      const durationMs = Date.now() - startTime;
      Logger.info('GistDB', `get() record not found for ${collection}/${id}`, { durationMs, found: false }, traceId);
      return null;
    }

    const data = await this.#maybeDecrypt(raw);
    await this.#cache!.write(cacheKey, data, raw._version);

    const durationMs = Date.now() - startTime;
    Logger.info('GistDB', `get() resolved via remote for ${collection}/${id}`, { durationMs, fromCache: false, version: raw._version }, traceId);
    return data;
  }

  async set(
    collection: string,
    id: string,
    data: any,
  ): Promise<{ id: string; version: string; updatedAt: string }> {
    this.#assertReady();
    this.#validate(collection, data);

    const traceId = Logger.createTraceId();
    const startTime = Date.now();
    Logger.debug('GistDB', `set() initiated for ${collection}/${id}`, undefined, traceId);

    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

    // Se estiver offline, pula a leitura remota/resolução de conflito imediata da API
    let remote: any = null;
    if (isOnline) {
      remote = await this.#transport!.getFile(
        this.#filename(collection, id),
      ).catch(() => null);
    }

    const cached = await this.#cache!.read(this.#key(collection, id));
    const currentVersion = remote?._version || cached?.version || 'v0';
    const version = this.#nextVersion(currentVersion);

    const payload = {
      ...data,
      _id: id,
      _version: version,
      _updatedAt: new Date().toISOString(),
      _device: this.#deviceInfo,
    };

    let remoteDecrypted = null;
    if (remote) {
      try {
        remoteDecrypted = await this.#maybeDecrypt(remote);
      } catch (err) {
        Logger.warn(
          'GistDB',
          'set: falha ao descriptografar remote, usando payload bruto',
          err,
          traceId,
        );
        remoteDecrypted = remote;
      }
    }

    const resolved = remote
      ? this.#resolver.resolve(payload, remoteDecrypted, {
          version,
        })
      : payload;

    const toWrite = await this.#maybeEncrypt(resolved);
    await this.#transport!.putFile(this.#filename(collection, id), toWrite);
    await this.#cache!.write(this.#key(collection, id), resolved, version);

    this.#notifyWatchers(collection, id, resolved);

    const durationMs = Date.now() - startTime;
    Logger.info('GistDB', `set() completed for ${collection}/${id}`, { durationMs, version, isOnline }, traceId);

    return { id, version, updatedAt: resolved._updatedAt };
  }

  async delete(collection: string, id: string): Promise<boolean> {
    this.#assertReady();
    await this.#transport!.deleteFile(this.#filename(collection, id));
    await this.#cache!.invalidate(this.#key(collection, id));
    this.#notifyWatchers(collection, id, null);
    return true;
  }

  async list(
    collection: string,
    filterFn: ((item: any) => boolean) | null = null,
  ): Promise<any[]> {
    this.#assertReady();
    const files = await this.#transport!.listFiles(collection);
    const results = await Promise.all(
      files.map(async (f) => {
        const data = await this.#maybeDecrypt(f);
        return data;
      }),
    );
    return filterFn ? results.filter(filterFn) : results;
  }

  // ─── SYNC ────────────────────────────────────────────────────

  async sync(): Promise<{ syncedAt: string }> {
    this.#assertReady();
    await this.#cache!.clear();
    await this.#transport!.flushQueue();
    return { syncedAt: new Date().toISOString() };
  }

  async getLastSyncAt(): Promise<string | null> {
    const meta = await this.#cache!.read(`${this.#prefix}:__meta__`);
    return meta?.data?.lastSyncAt ?? null;
  }

  /**
   * Observa mudanças em uma collection via polling.
   */
  watch(
    collection: string,
    callback: (id: string, data: any) => void,
    interval = 30_000,
  ): () => void {
    if (!this.#watchers.has(collection)) {
      this.#watchers.set(collection, new Set());
    }
    this.#watchers.get(collection)!.add(callback);

    if (!this.#pollIntervals.has(collection)) {
      const timer = setInterval(
        () => this.#pollCollection(collection),
        interval,
      );
      this.#pollIntervals.set(collection, timer);
    }

    return () => this.#unwatch(collection, callback);
  }

  #unwatch(
    collection: string,
    callback: (id: string, data: any) => void,
  ): void {
    const callbacks = this.#watchers.get(collection);
    if (callbacks) {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        this.#watchers.delete(collection);
        const timer = this.#pollIntervals.get(collection);
        if (timer) {
          clearInterval(timer as any);
          this.#pollIntervals.delete(collection);
        }
      }
    }
  }

  destroy(): void {
    this.#pollIntervals.forEach((t) => clearInterval(t as any));
    this.#pollIntervals.clear();
    this.#watchers.clear();
    this.#autoSyncCleanups.forEach((cleanup) => cleanup());
    this.#autoSyncCleanups = [];
    KeyVault.clear();
  }

  #setupAutoSync(
    opts:
      | boolean
      | {
          onFocus?: boolean;
          onReconnect?: boolean;
          onUnload?: boolean;
        },
  ): void {
    if (!opts) return;
    const cfg =
      typeof opts === 'boolean'
        ? { onFocus: true, onReconnect: true, onUnload: true }
        : {
            onFocus: opts.onFocus ?? true,
            onReconnect: opts.onReconnect ?? true,
            onUnload: opts.onUnload ?? true,
          };

    if (typeof window === 'undefined' && typeof document === 'undefined') return;

    if (cfg.onFocus && typeof document !== 'undefined') {
      const handleVisibility = () => {
        if (document.visibilityState === 'visible') {
          this.sync().catch(() => {});
        }
      };
      document.addEventListener('visibilitychange', handleVisibility);
      this.#autoSyncCleanups.push(() =>
        document.removeEventListener('visibilitychange', handleVisibility),
      );
    }

    if (cfg.onReconnect && typeof window !== 'undefined') {
      const handleOnline = () => {
        this.sync().catch(() => {});
      };
      window.addEventListener('online', handleOnline);
      this.#autoSyncCleanups.push(() =>
        window.removeEventListener('online', handleOnline),
      );
    }

    if (cfg.onUnload && typeof window !== 'undefined') {
      const handleUnload = () => {
        this.sync().catch(() => {});
      };
      window.addEventListener('beforeunload', handleUnload);
      this.#autoSyncCleanups.push(() =>
        window.removeEventListener('beforeunload', handleUnload),
      );
    }
  }

  // ─── INTERNOS ────────────────────────────────────────────────

  #key(collection: string, id: string): string {
    return `${this.#prefix}:${collection}:${id}`;
  }

  #filename(collection: string, id: string): string {
    return `gistdb_${this.#prefix}_${collection}_${id}.json`;
  }

  #nextVersion(current: string | null | undefined): string {
    const n = parseInt(current?.split('v')[1] ?? '0', 10);
    return `v${isNaN(n) ? 1 : n + 1}`;
  }

  async #maybeEncrypt(data: any): Promise<any> {
    if (!this.#crypto) return data;
    return this.#crypto.encrypt(data);
  }

  async #maybeDecrypt(data: any): Promise<any> {
    if (!this.#crypto) return data;
    try {
      return await this.#crypto.decrypt(data);
    } catch (err) {
      // Se a descriptografia falhar, emitimos logs estruturados para
      // investigação e tentamos re-derivar a chave a partir do `salt`.
      Logger.warn('GistDB', 'decrypt failed, attempting restore via salt', {
        hasSalt: !!data?.salt,
        passwordPresent: !!this.#password,
        // include payload analysis to aid diagnosis
        payload: CryptoManager.analyzePayload(data),
      });
      if (data?.salt && this.#password) {
        try {
          const restored = await CryptoManager.restore(
            this.#password,
            data.salt,
          );
          this.#crypto = restored;
          // Verifica integridade antes de tentar descriptografar
          try {
            const verified = await restored.verify(data).catch(() => false);
            Logger.info('GistDB', 'verify after restore', { verified });
            if (verified) {
              return await this.#crypto.decrypt(data);
            }
            Logger.warn(
              'GistDB',
              'payload verification failed after restore, returning raw payload',
            );
            return data;
          } catch (err3) {
            Logger.warn('GistDB', 'decrypt still failing after restore', {
              err: err3?.message || String(err3),
            });
            return data;
          }
        } catch (err2) {
          Logger.warn(
            'GistDB',
            'restore via salt failed, returning raw payload',
            {
              err: err2?.message || String(err2),
            },
          );
          return data;
        }
      }
      return data;
    }
  }

  #validate(collection: string, data: any): void {
    const validator = this.#schema?.[collection];
    if (validator && !validator(data)) {
      throw new GistDBError(
        'VALIDATION_ERROR',
        `Dados inválidos para collection "${collection}".`,
      );
    }
  }

  #assertReady(): void {
    if (!this.#gistId)
      throw new GistDBError('NOT_INITIALIZED', 'GistDB não inicializado.');
  }

  async #pollCollection(collection: string): Promise<void> {
    const files = await this.#transport!.listFiles(collection).catch(() => []);
    for (const f of files) {
      const data = await this.#maybeDecrypt(f);
      const cached = await this.#cache!.read(this.#key(collection, data._id));
      if (cached?.version !== data._version) {
        await this.#cache!.write(
          this.#key(collection, data._id),
          data,
          data._version,
        );
        this.#notifyWatchers(collection, data._id, data);
      }
    }
  }

  #notifyWatchers(collection: string, id: string, data: any): void {
    const callbacks = this.#watchers.get(collection);
    if (!callbacks) return;
    callbacks.forEach((cb) => cb(id, data));
  }
}

export { Logger };
