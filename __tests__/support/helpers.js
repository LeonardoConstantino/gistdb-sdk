import crypto from 'crypto';

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function toB64(buf) {
  return Buffer.from(buf).toString('base64');
}
function fromB64(s) {
  return Buffer.from(s, 'base64');
}

export async function mockCrypto(password) {
  const salt = crypto.randomBytes(12).toString('hex');
  const inst = {
    _salt: salt,
    async encrypt(obj) {
      const iv = crypto.randomBytes(8).toString('hex');
      const payload = JSON.stringify(obj);
      const combined = `${salt}:${iv}:${payload}`;
      const ciphertext = toB64(Buffer.from(combined, 'utf8'));
      return { __encrypted: true, iv, ciphertext, salt };
    },
    async decrypt(p) {
      if (!p?.__encrypted) return p;
      try {
        const decoded = fromB64(p.ciphertext).toString('utf8');
        const parts = decoded.split(':');
        const salt2 = parts.shift();
        const iv2 = parts.shift();
        const payload = parts.join(':');
        if (salt2 !== salt) return false;
        return JSON.parse(payload);
      } catch {
        return false;
      }
    },
    async verify(p) {
      const r = await inst.decrypt(p);
      return r !== false && r !== null;
    },
  };
  return inst;
}

export async function mockCryptoRestore(password, salt) {
  return {
    async decrypt(p) {
      if (!p?.__encrypted) return p;
      const decoded = fromB64(p.ciphertext).toString('utf8');
      const parts = decoded.split(':');
      const salt2 = parts.shift();
      const iv2 = parts.shift();
      const payload = parts.join(':');
      if (salt2 !== salt) throw new Error('salt mismatch');
      return JSON.parse(payload);
    },
  };
}

export function makeKeyVault() {
  let mem = null;
  const obf = (s) => Buffer.from(s, 'utf8').toString('base64');
  const deof = (s) => {
    try {
      return Buffer.from(s, 'base64').toString('utf8');
    } catch {
      return null;
    }
  };
  return {
    store(t) {
      if (!t || typeof t !== 'string') throw new Error('Token inválido.');
      mem = obf(t);
    },
    retrieve() {
      return mem ? deof(mem) : null;
    },
    clear() {
      mem = null;
    },
    has() {
      return mem !== null;
    },
  };
}

export function makeResolver(strategy, customFn = null) {
  const valid = ['last-write-wins', 'remote-wins', 'local-wins', 'custom'];
  if (!valid.includes(strategy))
    throw new Error(`estratégia inválida "${strategy}"`);
  if (strategy === 'custom' && typeof customFn !== 'function')
    throw new Error('forneça customFn');
  return {
    resolve(local, remote, meta) {
      if (!remote) return local;
      if (!local) return remote;
      if (strategy === 'last-write-wins') {
        const lt = new Date(local._updatedAt ?? 0).getTime();
        const rt = new Date(remote._updatedAt ?? 0).getTime();
        return lt >= rt ? local : remote;
      }
      if (strategy === 'remote-wins') return remote;
      if (strategy === 'local-wins') return local;
      if (strategy === 'custom') return customFn(local, remote, meta);
      return local;
    },
  };
}

export function makeCache(ttl = 60000) {
  const store = {};
  return {
    async read(key) {
      const e = store[key];
      if (!e) return null;
      if (Date.now() - e.cachedAt > ttl) {
        delete store[key];
        return null;
      }
      return e;
    },
    async write(key, data, version) {
      store[key] = { data, version, cachedAt: Date.now() };
    },
    async invalidate(key) {
      delete store[key];
    },
    async clear() {
      Object.keys(store).forEach((k) => delete store[k]);
    },
    async getVersion(key) {
      const e = await this.read(key);
      return e?.version ?? null;
    },
  };
}

export function makeTransport(opts = {}) {
  const _files = { ...(opts.files || {}) };
  const gistId = 'gist-123';
  const api = {
    calls: { updateGist: [], deleteFile: [], getGist: [] },
    _failNext: 0,
    _onFail: null,
    async getGist(id) {
      this.calls.getGist.push([id]);
      const files = {};
      Object.entries(_files).forEach(([k, v]) => {
        files[k] = { content: typeof v === 'string' ? v : JSON.stringify(v) };
      });
      return { id, files };
    },
    async updateGist(id, files) {
      if (this._failNext > 0) {
        this._failNext--;
        if (this._onFail) this._onFail();
        throw new Error('network error');
      }
      Object.entries(files).forEach(([k, v]) => {
        if (v === null) delete _files[k];
        else _files[k] = v.content;
      });
      this.calls.updateGist.push([id, files]);
    },
    async deleteFile(id, filename) {
      delete _files[filename];
      this.calls.deleteFile.push([id, filename]);
    },
    async listGists() {
      return [{ id: gistId, description: 'gistdb:app' }];
    },
    async createGist() {
      return gistId;
    },
  };

  const transport = {
    _api: api,
    _gistId: gistId,
    setGistId(id) {
      this._gistId = id;
    },
    async _retry(fn, attempt = 0) {
      try {
        return await fn();
      } catch (e) {
        if (attempt >= 2) throw e;
        await sleep(10);
        return this._retry(fn, attempt + 1);
      }
    },
    async getFile(filename) {
      const gist = await this._retry(() => api.getGist(this._gistId));
      if (!gist?.files?.[filename]) return null;
      try {
        return JSON.parse(gist.files[filename].content);
      } catch {
        return null;
      }
    },
    async putFile(filename, data) {
      const content = JSON.stringify(data, null, 2);
      await this._retry(() =>
        api.updateGist(this._gistId, { [filename]: { content } }),
      );
    },
    async deleteFile(filename) {
      await this._retry(() => api.deleteFile(this._gistId, filename));
    },
    async listFiles(collection) {
      const gist = await this._retry(() => api.getGist(this._gistId));
      if (!gist?.files) return [];
      return Object.entries(gist.files)
        .filter(([name]) => name.includes(`_${collection}_`))
        .map(([, f]) => {
          try {
            return JSON.parse(f.content);
          } catch {
            return null;
          }
        })
        .filter(Boolean);
    },
    async flushQueue() {
      return { flushed: 0, failed: 0 };
    },
  };
  return { transport, api };
}

export async function makeDB(opts = {}) {
  const { transport, api } = makeTransport();
  const cache = makeCache();
  const resolver = makeResolver('last-write-wins');
  const schema = opts.schema || {};
  let cryptoInst = null;
  if (opts.encryptionKey) cryptoInst = await mockCrypto(opts.encryptionKey);

  const store = {};

  async function maybeEncrypt(d) {
    return cryptoInst ? cryptoInst.encrypt(d) : d;
  }
  async function maybeDecrypt(d) {
    return cryptoInst ? cryptoInst.decrypt(d) : d;
  }

  function key(col, id) {
    return `${col}:${id}`;
  }
  function filename(col, id) {
    return `gistdb_app_${col}_${id}.json`;
  }
  function nextVer(v) {
    return `v${parseInt(v?.split('v')[1] ?? '0', 10) + 1}`;
  }

  const watchers = {};

  return {
    async set(collection, id, data) {
      const validator = schema[collection];
      if (validator && !validator(data))
        throw new Error(
          `VALIDATION_ERROR: dados inválidos para "${collection}"`,
        );
      const existing = await this.get(collection, id).catch(() => null);
      const version = nextVer(existing?._version);
      const payload = {
        ...data,
        _id: id,
        _version: version,
        _updatedAt: new Date().toISOString(),
      };
      const remote = await transport.getFile(filename(collection, id));
      const resolved = remote
        ? resolver.resolve(payload, await maybeDecrypt(remote), { version })
        : payload;
      const toWrite = await maybeEncrypt(resolved);
      await transport.putFile(filename(collection, id), toWrite);
      await cache.write(key(collection, id), resolved, version);
      (watchers[collection] || []).forEach((cb) => cb(id, resolved));
      return { id, version, updatedAt: resolved._updatedAt };
    },
    async get(collection, id) {
      const cached = await cache.read(key(collection, id));
      if (cached) return cached.data;
      const raw = await transport.getFile(filename(collection, id));
      if (!raw) return null;
      const data = await maybeDecrypt(raw);
      await cache.write(key(collection, id), data, data._version);
      return data;
    },
    async delete(collection, id) {
      await transport.deleteFile(filename(collection, id));
      await cache.invalidate(key(collection, id));
      (watchers[collection] || []).forEach((cb) => cb(id, null));
      return true;
    },
    async list(collection, filterFn = null) {
      const files = await transport.listFiles(collection);
      const results = await Promise.all(files.map((f) => maybeDecrypt(f)));
      return filterFn ? results.filter(filterFn) : results;
    },
    async sync() {
      await cache.clear();
      return { syncedAt: new Date().toISOString() };
    },
    async getLastSyncAt() {
      return null;
    },
    watch(collection, cb) {
      if (!watchers[collection]) watchers[collection] = [];
      watchers[collection].push(cb);
      return () => {
        watchers[collection] = watchers[collection].filter((f) => f !== cb);
      };
    },
    destroy() {
      Object.keys(watchers).forEach((k) => delete watchers[k]);
    },
  };
}
