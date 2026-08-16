/**
 * KeyVault — armazenamento seguro e efêmero do token GitHub.
 */

const SESSION_KEY = '__gdb_tk__';
let _memToken: string | null = null;

function obfuscate(str: string): string {
  // Compatibilidade com atob/btoa global ou Buffer no Node
  const utf8Bytes = new TextEncoder().encode(str);
  if (typeof btoa !== 'undefined') {
    return btoa(String.fromCharCode(...utf8Bytes));
  }
  return Buffer.from(utf8Bytes).toString('base64');
}

function deobfuscate(str: string): string | null {
  try {
    let raw: string;
    if (typeof atob !== 'undefined') {
      raw = atob(str);
    } else {
      raw = Buffer.from(str, 'base64').toString('binary');
    }
    const bytes = new Uint8Array([...raw].map((c) => c.charCodeAt(0)));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

export const KeyVault = {
  /**
   * Armazena o token em memória e sessionStorage.
   */
  store(token: string): void {
    if (!token || typeof token !== 'string') throw new Error('Token inválido.');
    _memToken = obfuscate(token);
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(SESSION_KEY, obfuscate(token));
      }
    } catch {}
  },

  /**
   * Recupera o token. Retorna null se não disponível.
   */
  retrieve(): string | null {
    if (_memToken) return deobfuscate(_memToken);
    try {
      if (typeof sessionStorage !== 'undefined') {
        const stored = sessionStorage.getItem(SESSION_KEY);
        if (stored) return deobfuscate(stored);
      }
    } catch {}
    return null;
  },

  /**
   * Remove o token de todos os armazenamentos.
   */
  clear(): void {
    _memToken = null;
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem(SESSION_KEY);
      }
    } catch {}
  },

  /**
   * Verifica se há token disponível sem expô-lo.
   */
  has(): boolean {
    return KeyVault.retrieve() !== null;
  },
};
