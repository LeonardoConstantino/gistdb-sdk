export interface GistTransportOptions {
  retries?: number;
  timeout?: number;
}

export interface OfflineOperation {
  type: 'PUT' | 'DELETE';
  filename: string;
  content?: string;
  enqueuedAt?: number;
}

const IDB_QUEUE_STORE = 'offline_queue';

/**
 * GistTransport — resiliência de rede sobre GistAPI.
 */
export class GistTransport {
  #api: any;
  #gistId: string | null = null;
  #retries: number;
  #timeout: number;
  #dbPromise: Promise<IDBDatabase | null>;

  constructor(api: any, { retries = 3, timeout = 8_000 }: GistTransportOptions = {}) {
    this.#api = api;
    this.#retries = retries;
    this.#timeout = timeout;
    this.#dbPromise = this.#initDB();
  }

  async #initDB(): Promise<IDBDatabase | null> {
    try {
      const idb = typeof indexedDB !== 'undefined' ? indexedDB : (globalThis as any).indexedDB;
      if (!idb) return null;
      return new Promise((resolve, reject) => {
        const req = idb.open('gistdb_transport_queue', 1);
        req.onupgradeneeded = (e: any) => {
          e.target.result.createObjectStore(IDB_QUEUE_STORE, { autoIncrement: true });
        };
        req.onsuccess = (e: any) => resolve(e.target.result);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return null;
    }
  }

  setGistId(id: string): void {
    this.#gistId = id;
  }

  async initGist(): Promise<string> {
    const existing = await this.#retry<any[]>(() => this.#api.listGists());
    if (existing.length > 0) return existing[0].id;
    return this.#retry<any>(() => this.#api.createGist({}, false));
  }

  async getFile(filename: string): Promise<any> {
    const gist = await this.#retry<any>(() => this.#api.getGist(this.#gistId));
    if (!gist?.files?.[filename]) return null;
    const raw = gist.files[filename].content;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async putFile(filename: string, data: any): Promise<void> {
    const content = JSON.stringify(data, null, 2);
    const op = () =>
      this.#api.updateGist(this.#gistId, { [filename]: { content } });

    // Fallback seguro se navigator não estiver definido (ex: Node/SSR)
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

    if (!isOnline) {
      await this.#enqueueOffline({ type: 'PUT', filename, content });
      return;
    }
    await this.#retry(op);
  }

  async deleteFile(filename: string): Promise<void> {
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

    if (!isOnline) {
      await this.#enqueueOffline({ type: 'DELETE', filename });
      return;
    }
    await this.#retry(() => this.#api.deleteFile(this.#gistId, filename));
  }

  async listFiles(collection: string): Promise<any[]> {
    const gist = await this.#retry<any>(() => this.#api.getGist(this.#gistId));
    if (!gist?.files) return [];

    return Object.entries(gist.files)
      .filter(([name]) => name.includes(`_${collection}_`))
      .map(([, file]: [string, any]) => {
        try {
          return JSON.parse(file.content);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  }

  async flushQueue(): Promise<{ flushed: number; failed: number }> {
    const queue = await this.#readQueue();
    const failed: OfflineOperation[] = [];

    for (const op of queue) {
      try {
        if (op.type === 'PUT') {
          await this.#retry(() =>
            this.#api.updateGist(this.#gistId, {
              [op.filename]: { content: op.content! },
            }),
          );
        } else if (op.type === 'DELETE') {
          await this.#retry(() =>
            this.#api.deleteFile(this.#gistId, op.filename),
          );
        }
      } catch {
        failed.push(op);
      }
    }

    await this.#saveQueue(failed);
    return { flushed: queue.length - failed.length, failed: failed.length };
  }

  // ─── RETRY ───────────────────────────────────────────────────

  async #retry<T>(fn: () => Promise<T>, attempt = 0): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.#timeout);

    try {
      const result = await fn();
      clearTimeout(timer);
      return result;
    } catch (err) {
      clearTimeout(timer);
      if (attempt >= this.#retries) throw err;
      const delay = 300 * 2 ** attempt + Math.random() * 100;
      await new Promise((r) => setTimeout(r, delay));
      return this.#retry(fn, attempt + 1);
    }
  }

  // ─── OFFLINE QUEUE (IndexedDB) ───────────────────────────────

  async #enqueueOffline(op: OfflineOperation): Promise<void> {
    const db = await this.#dbPromise;
    if (!db) {
      // Fallback síncrono para sessionStorage se IndexedDB falhar
      try {
        const queue = await this.#readQueueFallback();
        queue.push({ ...op, enqueuedAt: Date.now() });
        sessionStorage.setItem(IDB_QUEUE_STORE, JSON.stringify(queue));
      } catch {}
      return;
    }

    return new Promise((resolve) => {
      const tx = db.transaction(IDB_QUEUE_STORE, 'readwrite');
      const store = tx.objectStore(IDB_QUEUE_STORE);
      store.add({ ...op, enqueuedAt: Date.now() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve(); // continua sem travar
    });
  }

  async #readQueue(): Promise<OfflineOperation[]> {
    const db = await this.#dbPromise;
    if (!db) {
      return this.#readQueueFallback();
    }

    return new Promise((resolve) => {
      const tx = db.transaction(IDB_QUEUE_STORE, 'readonly');
      const store = tx.objectStore(IDB_QUEUE_STORE);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  }

  async #saveQueue(queue: OfflineOperation[]): Promise<void> {
    const db = await this.#dbPromise;
    if (!db) {
      try {
        sessionStorage.setItem(IDB_QUEUE_STORE, JSON.stringify(queue));
      } catch {}
      return;
    }

    return new Promise((resolve) => {
      const tx = db.transaction(IDB_QUEUE_STORE, 'readwrite');
      const store = tx.objectStore(IDB_QUEUE_STORE);
      const clearReq = store.clear();
      clearReq.onsuccess = () => {
        let count = 0;
        if (queue.length === 0) {
          resolve();
          return;
        }
        for (const op of queue) {
          const addReq = store.add(op);
          addReq.onsuccess = () => {
            count++;
            if (count === queue.length) resolve();
          };
          addReq.onerror = () => {
            count++;
            if (count === queue.length) resolve();
          };
        }
      };
      clearReq.onerror = () => resolve();
    });
  }

  async #readQueueFallback(): Promise<OfflineOperation[]> {
    try {
      const raw = sessionStorage.getItem(IDB_QUEUE_STORE);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }
}
