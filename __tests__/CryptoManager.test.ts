import { describe, test, expect } from '@jest/globals';
import { CryptoManager } from '../src/CryptoManager.js';

// Necessário para Web Crypto API no Node.js
import { webcrypto } from 'crypto';
if (!(globalThis as any).crypto) {
  (globalThis as any).crypto = webcrypto;
}

describe('CryptoManager', () => {
  test('encrypt() retorna objeto com iv, ciphertext e salt', async () => {
    const cm = await CryptoManager.fromPassword('senha123');
    const result = await cm.encrypt({ foo: 'bar' });
    expect(typeof result.iv).toBe('string');
    expect(typeof result.ciphertext).toBe('string');
    expect(typeof result.salt).toBe('string');
    expect(result.__encrypted).toBe(true);
  });

  test('decrypt() restaura o objeto original', async () => {
    const cm = await CryptoManager.fromPassword('minhasenha');
    const original = { titulo: 'teste', valor: 42, ativo: true };
    const encrypted = await cm.encrypt(original);
    const decrypted = await cm.decrypt(encrypted);
    expect(decrypted.titulo).toBe(original.titulo);
    expect(decrypted.valor).toBe(original.valor);
    expect(decrypted.ativo).toBe(original.ativo);
  });

  test('encrypt() gera IVs únicos a cada chamada', async () => {
    const cm = await CryptoManager.fromPassword('senha');
    const e1 = await cm.encrypt({ x: 1 });
    const e2 = await cm.encrypt({ x: 1 });
    expect(e1.iv).not.toBe(e2.iv);
  });

  test('decrypt() dados não-criptografados retorna o original', async () => {
    const cm = await CryptoManager.fromPassword('senha');
    const plain = { sem: 'criptografia' };
    const result = await cm.decrypt(plain);
    expect(result.sem).toBe(plain.sem);
  });

  test('verify() retorna true para payload válido', async () => {
    const cm = await CryptoManager.fromPassword('verificar');
    const enc = await cm.encrypt({ ok: true });
    const valid = await cm.verify(enc);
    expect(valid).toBe(true);
  });

  test('verify() retorna false para payload corrompido', async () => {
    const cm = await CryptoManager.fromPassword('verificar');
    const enc = await cm.encrypt({ ok: true });
    enc.ciphertext = enc.ciphertext.split('').reverse().join('');
    const valid = await cm.verify(enc);
    expect(valid).toBe(false);
  });

  test('restore() com mesma senha + salt deriva chave igual', async () => {
    const cm1 = await CryptoManager.fromPassword('igual');
    const enc = await cm1.encrypt({ segredo: 'x' });
    const saltBase64 = Buffer.from(cm1._salt!).toString('base64');
    const cm2 = await CryptoManager.restore('igual', saltBase64);
    const dec = await cm2.decrypt(enc);
    expect(dec.segredo).toBe('x');
  });
});
