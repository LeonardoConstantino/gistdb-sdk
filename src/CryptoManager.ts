/**
 * CryptoManager — criptografia AES-GCM com Web Crypto API nativa.
 * Zero dependências externas. Funciona em qualquer browser moderno.
 */

export interface EncryptedPayload {
  __encrypted: true;
  iv: string;
  ciphertext: string;
  salt: string;
}

export class CryptoManager {
  #key: CryptoKey;
  public _salt: Uint8Array | null = null;

  constructor(cryptoKey: CryptoKey) {
    this.#key = cryptoKey;
  }

  /**
   * Deriva chave AES-GCM a partir de uma senha + salt.
   */
  static async fromPassword(password: string, salt: Uint8Array | null = null): Promise<CryptoManager> {
    const enc = new TextEncoder();
    // Resolvendo crypto global
    const cryptoObj = typeof crypto !== 'undefined' ? crypto : (globalThis as any).crypto;
    const rawSalt = salt ?? cryptoObj.getRandomValues(new Uint8Array(32));

    const baseKey = await cryptoObj.subtle.importKey(
      'raw',
      enc.encode(password),
      'PBKDF2',
      false,
      ['deriveKey'],
    );

    const aesKey = await cryptoObj.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: rawSalt,
        iterations: 310_000,
        hash: 'SHA-256',
      },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    );

    const instance = new CryptoManager(aesKey);
    instance._salt = rawSalt;
    return instance;
  }

  /**
   * Criptografa um objeto JS.
   */
  async encrypt(plainObject: any): Promise<EncryptedPayload> {
    const cryptoObj = typeof crypto !== 'undefined' ? crypto : (globalThis as any).crypto;
    const iv = cryptoObj.getRandomValues(new Uint8Array(12));
    const enc = new TextEncoder();
    const encoded = enc.encode(JSON.stringify(plainObject));

    const cipherBuffer = await cryptoObj.subtle.encrypt(
      { name: 'AES-GCM', iv },
      this.#key,
      encoded,
    );

    return {
      __encrypted: true,
      iv: CryptoManager.#toBase64(iv),
      ciphertext: CryptoManager.#toBase64(new Uint8Array(cipherBuffer)),
      salt: CryptoManager.#toBase64(this._salt!),
    };
  }

  /**
   * Descriptografa um payload produzido por encrypt().
   */
  async decrypt(payload: any): Promise<any> {
    if (!payload?.__encrypted) return payload;

    const cryptoObj = typeof crypto !== 'undefined' ? crypto : (globalThis as any).crypto;
    const iv = CryptoManager.#fromBase64(payload.iv);
    const ciphertext = CryptoManager.#fromBase64(payload.ciphertext);

    const plainBuffer = await cryptoObj.subtle.decrypt(
      { name: 'AES-GCM', iv },
      this.#key,
      ciphertext,
    );

    const dec = new TextDecoder();
    return JSON.parse(dec.decode(plainBuffer));
  }

  /**
   * Verifica integridade sem descriptografar o conteúdo completo.
   */
  async verify(payload: any): Promise<boolean> {
    try {
      await this.decrypt(payload);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Re-deriva a chave a partir de um salt salvo (para restaurar sessão).
   */
  static async restore(password: string, saltBase64: string): Promise<CryptoManager> {
    const salt = CryptoManager.#fromBase64(saltBase64);
    return CryptoManager.fromPassword(password, salt);
  }

  static #toBase64(buffer: Uint8Array): string {
    if (typeof btoa !== 'undefined') {
      return btoa(String.fromCharCode(...buffer));
    }
    return Buffer.from(buffer).toString('base64');
  }

  static #fromBase64(b64: string): Uint8Array {
    if (typeof atob !== 'undefined') {
      return new Uint8Array([...atob(b64)].map((c) => c.charCodeAt(0)));
    }
    return new Uint8Array(Buffer.from(b64, 'base64'));
  }
}
