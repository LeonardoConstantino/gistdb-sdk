import { describe, test, expect, afterEach } from '@jest/globals';
import { KeyVault } from '../src/KeyVault.js';

describe('KeyVault', () => {
  afterEach(() => {
    KeyVault.clear();
  });

  test('store() e retrieve() funcionam em memória', () => {
    KeyVault.store('ghp_abc123');
    expect(KeyVault.retrieve()).toBe('ghp_abc123');
  });

  test('has() retorna true após store()', () => {
    KeyVault.store('token');
    expect(KeyVault.has()).toBe(true);
  });

  test('clear() apaga o token', () => {
    KeyVault.store('token');
    KeyVault.clear();
    expect(KeyVault.retrieve()).toBeNull();
    expect(KeyVault.has()).toBe(false);
  });

  test('store() lança erro para token inválido', () => {
    expect(() => KeyVault.store('')).toThrow();
    expect(() => KeyVault.store(null as any)).toThrow();
  });

  test('retrieve() retorna null quando não há token', () => {
    expect(KeyVault.retrieve()).toBeNull();
  });
});
