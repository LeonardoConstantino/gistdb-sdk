/**
 * KeyVault — armazenamento seguro e efêmero do token GitHub.
 *
 * Princípios de segurança:
 *  - Token NUNCA vai para localStorage (persiste entre sessões)
 *  - Memória in-process é o armazenamento primário
 *  - sessionStorage como fallback (limpo ao fechar a aba)
 *  - Token é ofuscado na memória (não é plaintext direto)
 *  - clear() remove tudo ao chamar destroy()
 *
 * AVISO: em extensões de browser, prefira chrome.storage.session
 * para isolamento por contexto de extensão.
 */

const SESSION_KEY = '__gdb_tk__';
let _memToken = null;

function obfuscate(str) {
  return btoa(unescape(encodeURIComponent(str)));
}

function deobfuscate(str) {
  try {
    return decodeURIComponent(escape(atob(str)));
  } catch {
    return null;
  }
}

export const KeyVault = {
  /**
   * Armazena o token em memória e sessionStorage.
   * @param {string} token
   */
  store(token) {
    if (!token || typeof token !== 'string') throw new Error('Token inválido.');
    _memToken = obfuscate(token);
    try {
      sessionStorage.setItem(SESSION_KEY, obfuscate(token));
    } catch {}
  },

  /**
   * Recupera o token. Retorna null se não disponível.
   * Usado como função (passada ao GistAPI) para não expor o valor diretamente.
   */
  retrieve() {
    if (_memToken) return deobfuscate(_memToken);
    try {
      const stored = sessionStorage.getItem(SESSION_KEY);
      if (stored) return deobfuscate(stored);
    } catch {}
    return null;
  },

  /**
   * Remove o token de todos os armazenamentos.
   * Chamar em destroy() ou logout.
   */
  clear() {
    _memToken = null;
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {}
  },

  /**
   * Verifica se há token disponível sem expô-lo.
   */
  has() {
    return KeyVault.retrieve() !== null;
  },
};
