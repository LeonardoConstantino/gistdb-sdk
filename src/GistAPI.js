import { GistDBError } from './errors.js';

const GITHUB_API = 'https://api.github.com';

/**
 * GistAPI — wrapper direto para a GitHub Gist REST API.
 * Responsabilidade única: mapear operações para HTTP.
 */
export class GistAPI {
  #getToken;
  #prefix;

  /**
   * @param {function} getToken  - função que retorna o token (do KeyVault)
   * @param {string}   prefix    - prefixo do projeto
   */
  constructor(getToken, prefix) {
    this.#getToken = getToken;
    this.#prefix = prefix;
  }

  async createGist(files = {}, isPublic = false) {
    const res = await this.#req('POST', '/gists', {
      description: `gistdb:${this.#prefix}`,
      public: isPublic,
      files,
    });
    return res.id;
  }

  async getGist(gistId) {
    return this.#req('GET', `/gists/${gistId}`);
  }

  async updateGist(gistId, files) {
    return this.#req('PATCH', `/gists/${gistId}`, { files });
  }

  async deleteFile(gistId, filename) {
    await this.#req('PATCH', `/gists/${gistId}`, {
      files: { [filename]: null },
    });
    return true;
  }

  /**
   * Lista gists do usuário filtrados pelo prefixo.
   */
  async listGists() {
    const all = await this.#req('GET', '/gists?per_page=100');
    return all.filter((g) => g.description === `gistdb:${this.#prefix}`);
  }

  // ─── HTTP INTERNO ────────────────────────────────────────────

  async #req(method, path, body = null) {
    const token = this.#getToken();
    if (!token) throw new GistDBError('NO_TOKEN', 'Token não disponível.');

    const opts = {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
    };

    if (body !== null) opts.body = JSON.stringify(body);

    const res = await fetch(`${GITHUB_API}${path}`, opts);

    if (res.status === 404) return null;
    if (res.status === 422)
      throw new GistDBError(
        'VALIDATION',
        'Payload inválido para a API do GitHub.',
      );
    if (res.status === 403)
      throw new GistDBError('RATE_LIMITED', 'Rate limit atingido.');
    if (!res.ok) {
      const msg = await res.text().catch(() => res.statusText);
      throw new GistDBError('API_ERROR', `GitHub API ${res.status}: ${msg}`);
    }

    if (res.status === 204) return true;
    return res.json();
  }
}
