import { describe, test, expect } from '@jest/globals';
import { ConflictResolver } from '../src/ConflictResolver.js';

describe('ConflictResolver', () => {
  test('last-write-wins: local mais recente vence', () => {
    const r = new ConflictResolver('last-write-wins');
    const local = { _updatedAt: '2024-06-01T12:00:00Z', v: 'local' };
    const remote = { _updatedAt: '2024-06-01T10:00:00Z', v: 'remote' };
    const res = r.resolve(local, remote, {});
    expect(res.v).toBe('local');
  });

  test('last-write-wins: remote mais recente vence', () => {
    const r = new ConflictResolver('last-write-wins');
    const local = { _updatedAt: '2024-06-01T08:00:00Z', v: 'local' };
    const remote = { _updatedAt: '2024-06-01T12:00:00Z', v: 'remote' };
    const res = r.resolve(local, remote, {});
    expect(res.v).toBe('remote');
  });

  test('remote-wins: sempre retorna remote', () => {
    const r = new ConflictResolver('remote-wins');
    const local = { _updatedAt: '2099-01-01T00:00:00Z', v: 'local' };
    const remote = { v: 'remote' };
    expect(r.resolve(local, remote, {}).v).toBe('remote');
  });

  test('local-wins: sempre retorna local', () => {
    const r = new ConflictResolver('local-wins');
    const local = { v: 'local' };
    const remote = { _updatedAt: '2099-01-01T00:00:00Z', v: 'remote' };
    expect(r.resolve(local, remote, {}).v).toBe('local');
  });

  test('merge: combina propriedades local sobre remote', () => {
    const r = new ConflictResolver('merge');
    const local = { a: 1, b: 'local' };
    const remote = { b: 'remote', c: 3 };
    const res = r.resolve(local, remote, {});
    expect(res.a).toBe(1);
    expect(res.b).toBe('local');
    expect(res.c).toBe(3);
  });

  test('custom: usa função fornecida', () => {
    const r = new ConflictResolver((l: any, rem: any) => ({ v: l.v + '+' + rem.v }));
    const res = r.resolve({ v: 'A' }, { v: 'B' }, {});
    expect(res.v).toBe('A+B');
  });

  test('resolve() sem remote retorna local', () => {
    const r = new ConflictResolver('last-write-wins');
    const local = { v: 'local' };
    expect(r.resolve(local, null, {}).v).toBe('local');
  });

  test('estratégia inválida lança erro', () => {
    expect(() => new ConflictResolver('inventada' as any)).toThrow();
  });
});
