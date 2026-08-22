import { GistDBError } from './errors.js';
import { Logger } from './Logger.js';

const GITHUB_API = 'https://api.github.com';

/**
 * GistAPI — wrapper direto para a GitHub Gist REST API.
 * Responsabilidade única: mapear operações para HTTP.
 */
export class GistAPI {
  #getToken: () => string | null;
  #prefix: string;

  constructor(getToken: () => string | null, prefix: string) {
    this.#getToken = getToken;
    this.#prefix = prefix;
  }

  async createGist(files: Record<string, any> = {}, isPublic = false): Promise<string> {
    const res = await this.#req('POST', '/gists', {
      description: `gistdb:${this.#prefix}`,
      public: isPublic,
      files,
    });
    return res.id;
  }

  async getGist(gistId: string): Promise<any> {
    return this.#req('GET', `/gists/${gistId}`);
  }

  async updateGist(gistId: string, files: Record<string, any>): Promise<any> {
    return this.#req('PATCH', `/gists/${gistId}`, { files });
  }

  async deleteFile(gistId: string, filename: string): Promise<boolean> {
    await this.#req('PATCH', `/gists/${gistId}`, {
      files: { [filename]: null },
    });
    return true;
  }

  /**
   * Lista gists do usuário filtrados pelo prefixo.
   */
  async listGists(): Promise<any[]> {
    const all = await this.#req('GET', '/gists?per_page=100');
    if (!Array.isArray(all)) return [];
    return all.filter((g: any) => g.description === `gistdb:${this.#prefix}`);
  }

  // ─── HTTP INTERNO ────────────────────────────────────────────

  async #req(method: string, path: string, body: any = null): Promise<any> {
    const token = this.#getToken();
    if (!token) throw new GistDBError('NO_TOKEN', 'Token não disponível.');

    const opts: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
    };

    if (body !== null) opts.body = JSON.stringify(body);

    const startTime = Date.now();
    Logger.debug('GistAPI', `HTTP Request ${method} ${path}`);

    let res: Response;
    try {
      res = await fetch(`${GITHUB_API}${path}`, opts);
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      Logger.error('GistAPI', `HTTP Request Failed: ${method} ${path}`, { durationMs, error: err?.message || String(err) });
      throw err;
    }

    const durationMs = Date.now() - startTime;
    Logger.info('GistAPI', `HTTP Response ${method} ${path} -> ${res.status}`, { durationMs, status: res.status });

    if (res.status === 404) return null;
    if (res.status === 422)
      throw new GistDBError(
        'VALIDATION_ERROR',
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
