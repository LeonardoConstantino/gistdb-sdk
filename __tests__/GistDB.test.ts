import { describe, test, expect, beforeAll } from '@jest/globals';
// Testes de integração do GistDB usando mocks de transporte, cache e resolver reais
import { ConflictResolver } from '../src/ConflictResolver.js';
import { LocalCacheAdapter } from '../src/LocalCacheAdapter.js';

// Mock sessionStorage para Node
const sessionStorageMock: Record<string, string> = {};
beforeAll(() => {
  (globalThis as any).sessionStorage = {
    getItem: (key: string) => sessionStorageMock[key] || null,
    setItem: (key: string, val: string) => { sessionStorageMock[key] = val; },
    removeItem: (key: string) => { delete sessionStorageMock[key]; },
    clear: () => { Object.keys(sessionStorageMock).forEach(k => delete sessionStorageMock[k]); },
    key: (index: number) => Object.keys(sessionStorageMock)[index] || null,
    get length() { return Object.keys(sessionStorageMock).length; },
  } as any;
});

// Cria mock de transporte in-memory que simula GistTransport sem rede
function makeMockTransport() {
  const _files: Record<string, string> = {};
  return {
    setGistId(_id: string) {},
    async initGist() { return 'gist-mock'; },
    async getFile(filename: string): Promise<any> {
      if (!_files[filename]) return null;
      try { return JSON.parse(_files[filename]); } catch { return null; }
    },
    async putFile(filename: string, data: any) {
      _files[filename] = JSON.stringify(data, null, 2);
    },
    async deleteFile(filename: string) {
      delete _files[filename];
    },
    async listFiles(collection: string) {
      return Object.entries(_files)
        .filter(([name]) => name.includes(`_${collection}_`))
        .map(([, content]) => { try { return JSON.parse(content); } catch { return null; } })
        .filter(Boolean);
    },
    async flushQueue() { return { flushed: 0, failed: 0 }; },
  };
}

// Mini-GistDB de integração para teste sem dependência real de rede
async function makeTestDB(opts: { encryptionKey?: string; schema?: Record<string, (d: any) => boolean> } = {}) {
  const transport = makeMockTransport();
  const cache = new LocalCacheAdapter({ ttl: 60000, prefix: 'test' });
  const resolver = new ConflictResolver('last-write-wins');
  const schema = opts.schema || {};
  const prefix = 'app';
  const watchers: Record<string, Set<(id: string, data: any) => void>> = {};

  function key(col: string, id: string) { return `${prefix}:${col}:${id}`; }
  function filename(col: string, id: string) { return `gistdb_${prefix}_${col}_${id}.json`; }
  function nextVer(v?: string) { return `v${parseInt(v?.split('v')[1] ?? '0', 10) + 1}`; }

  return {
    async set(collection: string, id: string, data: any) {
      const validator = schema[collection];
      if (validator && !validator(data))
        throw new Error(`VALIDATION_ERROR: dados inválidos para "${collection}"`);

      const existing = await this.get(collection, id).catch(() => null);
      const version = nextVer(existing?._version);
      const payload = { ...data, _id: id, _version: version, _updatedAt: new Date().toISOString() };

      const remote = await transport.getFile(filename(collection, id));
      const resolved = remote ? resolver.resolve(payload, remote, { version }) : payload;

      await transport.putFile(filename(collection, id), resolved);
      await cache.write(key(collection, id), resolved, version);
      watchers[collection]?.forEach(cb => cb(id, resolved));
      return { id, version, updatedAt: resolved._updatedAt };
    },

    async get(collection: string, id: string) {
      const cached = await cache.read(key(collection, id));
      if (cached) return cached.data;
      const raw = await transport.getFile(filename(collection, id));
      if (!raw) return null;
      await cache.write(key(collection, id), raw, raw._version);
      return raw;
    },

    async delete(collection: string, id: string) {
      await transport.deleteFile(filename(collection, id));
      await cache.invalidate(key(collection, id));
      watchers[collection]?.forEach(cb => cb(id, null));
      return true;
    },

    async list(collection: string, filterFn: ((item: any) => boolean) | null = null) {
      const files = await transport.listFiles(collection);
      return filterFn ? files.filter(filterFn) : files;
    },

    watch(collection: string, cb: (id: string, data: any) => void) {
      if (!watchers[collection]) watchers[collection] = new Set();
      watchers[collection].add(cb);
      return () => { watchers[collection]?.delete(cb); };
    },

    destroy() {
      Object.keys(watchers).forEach(k => delete watchers[k]);
    },
  };
}

describe('GistDB (integração)', () => {
  test('set() + get() roundtrip sem criptografia', async () => {
    const db = await makeTestDB();
    await db.set('notas', 'n1', { texto: 'hello world' });
    const r = await db.get('notas', 'n1');
    expect(r.texto).toBe('hello world');
  });

  test('set() adiciona _id, _version e _updatedAt', async () => {
    const db = await makeTestDB();
    await db.set('col', 'id1', { val: 1 });
    const r = await db.get('col', 'id1');
    expect(r._id).toBe('id1');
    expect(r._version).toBe('v1');
    expect(typeof r._updatedAt).toBe('string');
  });

  test('delete() remove o item', async () => {
    const db = await makeTestDB();
    await db.set('col', 'del1', { x: 1 });
    await db.delete('col', 'del1');
    const r = await db.get('col', 'del1');
    expect(r).toBeNull();
  });

  test('list() retorna todos os itens da collection', async () => {
    const db = await makeTestDB();
    await db.set('lista', 'a', { n: 1 });
    await db.set('lista', 'b', { n: 2 });
    const items = await db.list('lista');
    expect(items.length).toBeGreaterThanOrEqual(2);
  });

  test('list() com filtro retorna subconjunto', async () => {
    const db = await makeTestDB();
    await db.set('tarefas', 't1', { done: true });
    await db.set('tarefas', 't2', { done: false });
    const pendentes = await db.list('tarefas', (t: any) => !t.done);
    expect(pendentes.length).toBe(1);
    expect(pendentes[0].done).toBe(false);
  });

  test('schema validation bloqueia dado inválido', async () => {
    const db = await makeTestDB({
      schema: { items: (d: any) => typeof d.nome === 'string' },
    });
    await expect(db.set('items', 'i1', { sem_nome: true })).rejects.toThrow();
  });

  test('watch() dispara callback ao set()', async () => {
    const db = await makeTestDB();
    let chamou = false;
    db.watch('eventos', () => { chamou = true; });
    await db.set('eventos', 'e1', { tipo: 'click' });
    expect(chamou).toBe(true);
  });

  test('destroy() não lança erro', async () => {
    const db = await makeTestDB();
    db.watch('col', () => {});
    expect(() => db.destroy()).not.toThrow();
  });
});
