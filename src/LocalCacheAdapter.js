/**
 * LocalCacheAdapter — cache local com TTL e fingerprint de versão.
 *
 * Usa IndexedDB quando disponível, com fallback para sessionStorage.
 * Nunca persiste o token de API — apenas dados da aplicação.
 */
export class LocalCacheAdapter {
  #prefix;
  #ttl;
  #db = null;
  #useIDB = false;

  constructor({ ttl = 5 * 60 * 1000, prefix = 'gistdb' } = {}) {
    this.#ttl = ttl;
    this.#prefix = prefix;
    this.#init();
  }

  async #init() {
    try {
      this.#db = await this.#openIDB();
      this.#useIDB = true;
    } catch {
      this.#useIDB = false;
    }
  }

  async read(key) {
    const entry = await this.#get(key);
    if (!entry) return null;
    if (Date.now() - entry.cachedAt > this.#ttl) {
      await this.invalidate(key);
      return null;
    }
    return entry;
  }

  async write(key, data, version) {
    const entry = { data, version, cachedAt: Date.now() };
    await this.#set(key, entry);
  }

  async invalidate(key) {
    await this.#del(key);
  }

  async clear() {
    if (this.#useIDB && this.#db) {
      const tx = this.#db.transaction('cache', 'readwrite');
      await this.#idbReq(tx.objectStore('cache').clear());
    } else {
      Object.keys(sessionStorage)
        .filter((k) => k.startsWith(this.#prefix))
        .forEach((k) => sessionStorage.removeItem(k));
    }
  }

  async getVersion(key) {
    const entry = await this.read(key);
    return entry?.version ?? null;
  }

  // ─── IDB / sessionStorage ────────────────────────────────────

  async #get(key) {
    const fullKey = `${this.#prefix}:${key}`;
    if (this.#useIDB && this.#db) {
      const tx = this.#db.transaction('cache', 'readonly');
      return this.#idbReq(tx.objectStore('cache').get(fullKey));
    }
    try {
      return JSON.parse(sessionStorage.getItem(fullKey));
    } catch {
      return null;
    }
  }

  async #set(key, value) {
    const fullKey = `${this.#prefix}:${key}`;
    if (this.#useIDB && this.#db) {
      const tx = this.#db.transaction('cache', 'readwrite');
      await this.#idbReq(tx.objectStore('cache').put(value, fullKey));
      return;
    }
    try {
      sessionStorage.setItem(fullKey, JSON.stringify(value));
    } catch {}
  }

  async #del(key) {
    const fullKey = `${this.#prefix}:${key}`;
    if (this.#useIDB && this.#db) {
      const tx = this.#db.transaction('cache', 'readwrite');
      await this.#idbReq(tx.objectStore('cache').delete(fullKey));
      return;
    }
    sessionStorage.removeItem(fullKey);
  }

  #openIDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('gistdb_cache', 1);
      req.onupgradeneeded = (e) => e.target.result.createObjectStore('cache');
      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror = () => reject(req.error);
    });
  }

  #idbReq(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
}
