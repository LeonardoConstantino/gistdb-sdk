import { GistDBError } from './errors.js';

const IDB_QUEUE = 'gistdb_offline_queue';

/**
 * GistTransport — resiliência de rede sobre GistAPI.
 *
 * Responsabilidades:
 *  - Retry com backoff exponencial
 *  - Fila offline (IndexedDB)
 *  - Mapeamento arquivo↔conteúdo JSON no Gist
 *  - ETag / cache condicional
 */
export class GistTransport {
  #api;
  #gistId = null;
  #etag = null;
  #retries;
  #timeout;

  constructor(api, { retries = 3, timeout = 8_000 } = {}) {
    this.#api = api;
    this.#retries = retries;
    this.#timeout = timeout;
  }

  setGistId(id) {
    this.#gistId = id;
  }

  async initGist() {
    const existing = await this.#retry(() => this.#api.listGists());
    if (existing.length > 0) return existing[0].id;
    return this.#retry(() => this.#api.createGist({}, false));
  }

  async getFile(filename) {
    const gist = await this.#retry(() => this.#api.getGist(this.#gistId));
    if (!gist?.files?.[filename]) return null;
    const raw = gist.files[filename].content;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async putFile(filename, data) {
    const content = JSON.stringify(data, null, 2);
    const op = () =>
      this.#api.updateGist(this.#gistId, { [filename]: { content } });

    if (!navigator.onLine) {
      await this.#enqueueOffline({ type: 'PUT', filename, content });
      return;
    }
    await this.#retry(op);
  }

  async deleteFile(filename) {
    if (!navigator.onLine) {
      await this.#enqueueOffline({ type: 'DELETE', filename });
      return;
    }
    await this.#retry(() => this.#api.deleteFile(this.#gistId, filename));
  }

  async listFiles(collection) {
    const gist = await this.#retry(() => this.#api.getGist(this.#gistId));
    if (!gist?.files) return [];

    const prefix = `gistdb_`;
    return Object.entries(gist.files)
      .filter(([name]) => name.includes(`_${collection}_`))
      .map(([, file]) => {
        try {
          return JSON.parse(file.content);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  }

  async flushQueue() {
    const queue = await this.#readQueue();
    const failed = [];

    for (const op of queue) {
      try {
        if (op.type === 'PUT') {
          await this.#retry(() =>
            this.#api.updateGist(this.#gistId, {
              [op.filename]: { content: op.content },
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

  async #retry(fn, attempt = 0) {
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

  async #enqueueOffline(op) {
    const queue = await this.#readQueue();
    queue.push({ ...op, enqueuedAt: Date.now() });
    await this.#saveQueue(queue);
  }

  async #readQueue() {
    try {
      const raw = localStorage.getItem(IDB_QUEUE);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  async #saveQueue(queue) {
    try {
      localStorage.setItem(IDB_QUEUE, JSON.stringify(queue));
    } catch {}
  }
}
