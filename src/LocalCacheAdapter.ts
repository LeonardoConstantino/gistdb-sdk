/**
 * LocalCacheAdapter — cache local com TTL e fingerprint de versão.
 *
 * Usa IndexedDB quando disponível, com fallback para sessionStorage.
 * Nunca persiste o token de API — apenas dados da aplicação.
 */

export interface CacheEntry<T = any> {
  data: T;
  version: string;
  cachedAt: number;
}

export interface LocalCacheAdapterOptions {
  ttl?: number;
  prefix?: string;
}

export class LocalCacheAdapter {
  #prefix: string;
  #ttl: number;
  #db: IDBDatabase | null = null;
  #useIDB = false;
  #initPromise: Promise<void>;

  constructor({ ttl = 5 * 60 * 1000, prefix = 'gistdb' }: LocalCacheAdapterOptions = {}) {
    this.#ttl = ttl;
    this.#prefix = prefix;
    this.#initPromise = this.#init();
  }

  async #init(): Promise<void> {
    try {
      this.#db = await this.#openIDB();
      this.#useIDB = true;
    } catch {
      this.#useIDB = false;
    }
  }

  async read<T = any>(key: string): Promise<CacheEntry<T> | null> {
    await this.#initPromise;
    const entry = await this.#get<CacheEntry<T>>(key);
    if (!entry) return null;
    if (Date.now() - entry.cachedAt > this.#ttl) {
      await this.invalidate(key);
      return null;
    }
    return entry;
  }

  async write<T = any>(key: string, data: T, version: string): Promise<void> {
    await this.#initPromise;
    const entry: CacheEntry<T> = { data, version, cachedAt: Date.now() };
    await this.#set(key, entry);
  }

  async invalidate(key: string): Promise<void> {
    await this.#initPromise;
    await this.#del(key);
  }

  async clear(): Promise<void> {
    await this.#initPromise;
    if (this.#useIDB && this.#db) {
      const tx = this.#db.transaction('cache', 'readwrite');
      await this.#idbReq<void>(tx.objectStore('cache').clear());
    } else {
      const pref = `${this.#prefix}:`;
      const keysToRemove: string[] = [];
      for (let i = 0; i < (sessionStorage as any).length; i++) {
        const k = (sessionStorage as any).key(i);
        if (k && k.startsWith(pref)) keysToRemove.push(k);
      }
      keysToRemove.forEach((k) => sessionStorage.removeItem(k));
    }
  }

  async getVersion(key: string): Promise<string | null> {
    await this.#initPromise;
    const entry = await this.read(key);
    return entry?.version ?? null;
  }

  // ─── IDB / sessionStorage ────────────────────────────────────

  async #get<T = any>(key: string): Promise<T | null> {
    const fullKey = `${this.#prefix}:${key}`;
    if (this.#useIDB && this.#db) {
      const tx = this.#db.transaction('cache', 'readonly');
      return this.#idbReq<T>(tx.objectStore('cache').get(fullKey));
    }
    try {
      const item = sessionStorage.getItem(fullKey);
      return item ? JSON.parse(item) : null;
    } catch {
      return null;
    }
  }

  async #set(key: string, value: any): Promise<void> {
    const fullKey = `${this.#prefix}:${key}`;
    if (this.#useIDB && this.#db) {
      const tx = this.#db.transaction('cache', 'readwrite');
      await this.#idbReq<IDBValidKey>(tx.objectStore('cache').put(value, fullKey));
      return;
    }
    try {
      sessionStorage.setItem(fullKey, JSON.stringify(value));
    } catch {}
  }

  async #del(key: string): Promise<void> {
    const fullKey = `${this.#prefix}:${key}`;
    if (this.#useIDB && this.#db) {
      const tx = this.#db.transaction('cache', 'readwrite');
      await this.#idbReq<void>(tx.objectStore('cache').delete(fullKey));
      return;
    }
    sessionStorage.removeItem(fullKey);
  }

  #openIDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      // Usar a propriedade global indexedDB com fallback para Node se necessário em ambiente de teste
      const idb = typeof indexedDB !== 'undefined' ? indexedDB : (globalThis as any).indexedDB;
      if (!idb) {
        reject(new Error('IndexedDB not supported'));
        return;
      }
      const req = idb.open('gistdb_cache', 1);
      req.onupgradeneeded = (e: any) => e.target.result.createObjectStore('cache');
      req.onsuccess = (e: any) => resolve(e.target.result);
      req.onerror = () => reject(req.error);
    });
  }

  #idbReq<T>(req: IDBRequest): Promise<T> {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
}
