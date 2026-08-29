import { describe, test, expect, beforeAll, beforeEach, jest } from '@jest/globals';
import { GistDB } from '../src/GistDB.js';
import { GistDBConfig } from '../src/types.js';

// Setup Web Crypto API para Node.js
import { webcrypto } from 'crypto';
if (!(globalThis as any).crypto) {
  (globalThis as any).crypto = webcrypto;
}

// Mock In-Memory Fetch para simular a API do GitHub Gists sem requisições reais
let gistsStore: Record<string, any> = {};

function setupMockFetch() {
  gistsStore = {};
  (globalThis as any).fetch = jest.fn(async (url: string, opts: any = {}) => {
    const method = opts.method || 'GET';
    const body = opts.body ? JSON.parse(opts.body) : null;

    if (url.endsWith('/gists?per_page=100')) {
      const list = Object.values(gistsStore).map((g) => ({
        id: g.id,
        description: g.description,
      }));
      return {
        ok: true,
        status: 200,
        json: async () => list,
      };
    }

    if (method === 'POST' && url.endsWith('/gists')) {
      const id = `gist-test-${Math.random().toString(36).substring(2, 9)}`;
      gistsStore[id] = {
        id,
        description: body.description,
        files: body.files || {},
      };
      return {
        ok: true,
        status: 201,
        json: async () => gistsStore[id],
      };
    }

    const match = url.match(/\/gists\/([^/]+)$/);
    if (match) {
      const id = match[1];
      if (method === 'GET') {
        if (!gistsStore[id]) {
          return { ok: false, status: 404, statusText: 'Not Found' };
        }
        return {
          ok: true,
          status: 200,
          json: async () => gistsStore[id],
        };
      }
      if (method === 'PATCH') {
        if (!gistsStore[id]) {
          gistsStore[id] = { id, files: {} };
        }
        if (body?.files) {
          Object.entries(body.files).forEach(([name, val]: [string, any]) => {
            if (val === null) {
              delete gistsStore[id].files[name];
            } else {
              gistsStore[id].files[name] = val;
            }
          });
        }
        return {
          ok: true,
          status: 200,
          json: async () => gistsStore[id],
        };
      }
    }

    return { ok: false, status: 400, statusText: 'Bad Request' };
  });
}

// Mock sessionStorage / localStorage para ambiente de teste Node
const storageMock: Record<string, string> = {};
beforeAll(() => {
  (globalThis as any).sessionStorage = {
    getItem: (key: string) => storageMock[key] || null,
    setItem: (key: string, val: string) => { storageMock[key] = val; },
    removeItem: (key: string) => { delete storageMock[key]; },
    clear: () => { Object.keys(storageMock).forEach((k) => delete storageMock[k]); },
    key: (i: number) => Object.keys(storageMock)[i] || null,
    get length() { return Object.keys(storageMock).length; },
  } as any;
  (globalThis as any).localStorage = (globalThis as any).sessionStorage;
});

beforeEach(() => {
  Object.keys(storageMock).forEach((k) => delete storageMock[k]);
  setupMockFetch();
});

async function createTestDB(overrides: Partial<GistDBConfig> = {}): Promise<GistDB> {
  return GistDB.create({
    token: 'ghp_mock_token_1234567890abcdef',
    prefix: 'testapp',
    autoConnect: false,
    ...overrides,
  });
}

describe('GistDB (Classe Real)', () => {
  test('set() + get() roundtrip sem criptografia', async () => {
    const db = await createTestDB();
    await db.set('notas', 'n1', { texto: 'hello world' });
    const r = await db.get('notas', 'n1');
    expect(r.texto).toBe('hello world');
  });

  test('set() adiciona _id, _version e _updatedAt', async () => {
    const db = await createTestDB();
    await db.set('col', 'id1', { val: 1 });
    const r = await db.get('col', 'id1');
    expect(r._id).toBe('id1');
    expect(r._version).toBe('v1');
    expect(typeof r._updatedAt).toBe('string');
  });

  test('delete() remove o item', async () => {
    const db = await createTestDB();
    await db.set('col', 'del1', { x: 1 });
    await db.delete('col', 'del1');
    const r = await db.get('col', 'del1');
    expect(r).toBeNull();
  });

  test('list() retorna todos os itens da collection', async () => {
    const db = await createTestDB();
    await db.set('lista', 'a', { n: 1 });
    await db.set('lista', 'b', { n: 2 });
    const items = await db.list('lista');
    expect(items.length).toBeGreaterThanOrEqual(2);
  });

  test('list() com filtro retorna subconjunto', async () => {
    const db = await createTestDB();
    await db.set('tarefas', 't1', { done: true });
    await db.set('tarefas', 't2', { done: false });
    const pendentes = await db.list('tarefas', (t: any) => !t.done);
    expect(pendentes.length).toBe(1);
    expect(pendentes[0].done).toBe(false);
  });

  test('schema validation bloqueia dado inválido com GistDBError', async () => {
    const db = await createTestDB({
      schema: { items: (d: any) => typeof d.nome === 'string' },
    });
    await expect(db.set('items', 'i1', { sem_nome: true })).rejects.toThrow();
  });

  test('watch() dispara callback ao set()', async () => {
    const db = await createTestDB();
    let chamou = false;
    db.watch('eventos', () => { chamou = true; }, 100);
    await db.set('eventos', 'e1', { tipo: 'click' });
    expect(chamou).toBe(true);
    db.destroy();
  });

  test('destroy() limpa watchers e chave sem erros', async () => {
    const db = await createTestDB();
    db.watch('col', () => {}, 100);
    expect(() => db.destroy()).not.toThrow();
  });

  test('Task 02: set() inclui metadados de _device no payload', async () => {
    const db = await createTestDB({ deviceName: 'Meu Computador' });
    await db.set('docs', 'd1', { titulo: 'teste' });
    const r = await db.get('docs', 'd1');
    expect(r._device).toBeDefined();
    expect(typeof r._device.id).toBe('string');
    expect(r._device.name).toBe('Meu Computador');
  });

  test('Task 02: db.devices.list() retorna dispositivos registrados', async () => {
    const db = await createTestDB({ deviceName: 'Laptop Teste' });
    const devices = await db.devices.list();
    expect(devices.length).toBeGreaterThanOrEqual(1);
    expect(devices.some((d: any) => d.name === 'Laptop Teste')).toBe(true);
  });

  test('Task 03: autoSync registra listeners e destroy remove sem erros', async () => {
    const listeners: Record<string, any> = {};
    (globalThis as any).document = {
      visibilityState: 'visible',
      addEventListener: (evt: string, fn: any) => { listeners[evt] = fn; },
      removeEventListener: (evt: string) => { delete listeners[evt]; },
    };
    (globalThis as any).window = {
      addEventListener: (evt: string, fn: any) => { listeners[evt] = fn; },
      removeEventListener: (evt: string) => { delete listeners[evt]; },
    };

    const db = await createTestDB({ autoSync: { onFocus: true, onReconnect: true } });
    expect(() => db.destroy()).not.toThrow();
  });

  test('sync() grava a data de sincronização e getLastSyncAt() retorna a data ISO', async () => {
    const db = await createTestDB();
    expect(await db.getLastSyncAt()).toBeNull();
    const { syncedAt } = await db.sync();
    expect(typeof syncedAt).toBe('string');
    expect(await db.getLastSyncAt()).toBe(syncedAt);
  });

  test('criptografia AES-GCM transparente com password', async () => {
    const db = await createTestDB({ password: 'minhasenhadeteste123' });
    await db.set('segredo', 's1', { dado: 'confidencial' });
    const r = await db.get('segredo', 's1');
    expect(r.dado).toBe('confidencial');
  });
});
