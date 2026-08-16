import { describe, test, expect, beforeAll } from '@jest/globals';
import { LocalCacheAdapter } from '../src/LocalCacheAdapter.js';

// Helper local para sleep nos testes
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('LocalCacheAdapter', () => {
  // Mock do sessionStorage para ambiente de testes Node
  const sessionStorageMock: Record<string, string> = {};
  beforeAll(() => {
    globalThis.sessionStorage = {
      getItem: (key: string) => sessionStorageMock[key] || null,
      setItem: (key: string, val: string) => { sessionStorageMock[key] = val; },
      removeItem: (key: string) => { delete sessionStorageMock[key]; },
      clear: () => { Object.keys(sessionStorageMock).forEach(k => delete sessionStorageMock[k]); },
      key: (index: number) => Object.keys(sessionStorageMock)[index] || null,
      get length() { return Object.keys(sessionStorageMock).length; }
    } as any;
  });

  test('write() + read() retorna dado correto', async () => {
    const c = new LocalCacheAdapter({ prefix: 'test-cache' });
    await c.write('k1', { nome: 'teste' }, 'v1');
    const r = await c.read('k1');
    expect(r).not.toBeNull();
    expect(r!.data.nome).toBe('teste');
    expect(r!.version).toBe('v1');
  });

  test('read() retorna null para chave inexistente', async () => {
    const c = new LocalCacheAdapter({ prefix: 'test-cache' });
    const r = await c.read('nao-existe');
    expect(r).toBeNull();
  });

  test('invalidate() remove a entrada', async () => {
    const c = new LocalCacheAdapter({ prefix: 'test-cache' });
    await c.write('k2', { x: 1 }, 'v1');
    await c.invalidate('k2');
    const r = await c.read('k2');
    expect(r).toBeNull();
  });

  test('read() retorna null após TTL expirado', async () => {
    const c = new LocalCacheAdapter({ ttl: 50, prefix: 'test-cache' });
    await c.write('k3', { y: 2 }, 'v1');
    await sleep(80);
    const r = await c.read('k3');
    expect(r).toBeNull();
  });

  test('clear() remove todas as entradas', async () => {
    const c = new LocalCacheAdapter({ prefix: 'test-cache' });
    await c.write('a', {}, 'v1');
    await c.write('b', {}, 'v1');
    await c.clear();
    expect(await c.read('a')).toBeNull();
    expect(await c.read('b')).toBeNull();
  });

  test('getVersion() retorna versão correta', async () => {
    const c = new LocalCacheAdapter({ prefix: 'test-cache' });
    await c.write('k4', {}, 'v7');
    expect(await c.getVersion('k4')).toBe('v7');
  });
});
