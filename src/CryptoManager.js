/**
 * CryptoManager — criptografia AES-GCM com Web Crypto API nativa.
 * Zero dependências externas. Funciona em qualquer browser moderno.
 *
 * Segurança:
 *  - AES-GCM 256-bit: autenticado, com IV único por operação
 *  - PBKDF2 SHA-256: 310.000 iterações (OWASP 2024)
 *  - Salt aleatório por instância (salvo junto ao payload)
 */
export class CryptoManager {
  #key = null;

  constructor(cryptoKey) {
    this.#key = cryptoKey;
  }

  /**
   * Deriva chave AES-GCM a partir de uma senha + salt.
   * @param {string} password
   * @param {Uint8Array} [salt]  - gerado aleatoriamente se omitido
   */
  static async fromPassword(password, salt = null) {
    const enc = new TextEncoder();
    const rawSalt = salt ?? crypto.getRandomValues(new Uint8Array(32));

    const baseKey = await crypto.subtle.importKey(
      'raw',
      enc.encode(password),
      'PBKDF2',
      false,
      ['deriveKey'],
    );

    const aesKey = await crypto.subtle.deriveKey(
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
   * @param {object} plainObject
   * @returns {{ iv: string, ciphertext: string, salt: string }}
   */
  async encrypt(plainObject) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const enc = new TextEncoder();
    const encoded = enc.encode(JSON.stringify(plainObject));

    const cipherBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      this.#key,
      encoded,
    );

    return {
      __encrypted: true,
      iv: CryptoManager.#toBase64(iv),
      ciphertext: CryptoManager.#toBase64(new Uint8Array(cipherBuffer)),
      salt: CryptoManager.#toBase64(this._salt),
    };
  }

  /**
   * Descriptografa um payload produzido por encrypt().
   * @param {{ iv, ciphertext, salt }} payload
   * @returns {object}
   */
  async decrypt(payload) {
    if (!payload?.__encrypted) return payload;

    const iv = CryptoManager.#fromBase64(payload.iv);
    const ciphertext = CryptoManager.#fromBase64(payload.ciphertext);

    const plainBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      this.#key,
      ciphertext,
    );

    const dec = new TextDecoder();
    return JSON.parse(dec.decode(plainBuffer));
  }

  /**
   * Verifica integridade sem descriptografar o conteúdo completo.
   * Tenta decrypt e retorna true/false sem lançar erro para o caller.
   */
  async verify(payload) {
    try {
      await this.decrypt(payload);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Re-deriva a chave a partir de um salt salvo (para restaurar sessão).
   * @param {string} password
   * @param {string} saltBase64
   */
  static async restore(password, saltBase64) {
    const salt = CryptoManager.#fromBase64(saltBase64);
    return CryptoManager.fromPassword(password, salt);
  }

  static #toBase64(buffer) {
    return btoa(String.fromCharCode(...buffer));
  }

  static #fromBase64(b64) {
    return new Uint8Array([...atob(b64)].map((c) => c.charCodeAt(0)));
  }
}
