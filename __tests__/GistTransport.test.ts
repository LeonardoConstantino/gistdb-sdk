import { describe, test, expect } from '@jest/globals';
import { GistTransport } from '../src/GistTransport.js';

// Mock de API simplificada que simula a GistAPI sem fazer chamadas reais de rede
function makeMockApi(initialFiles: Record<string, any> = {}) {
  const _files: Record<string, any> = { ...initialFiles };
  const calls = {
    updateGist: [] as any[],
    deleteFile: [] as any[],
    getGist: [] as any[],
  };
  let _failNext = 0;
  let _onFail: (() => void) | null = null;

  return {
    calls,
    get failNext() { return _failNext; },
    set failNext(n: number) { _failNext = n; },
    get onFail() { return _onFail; },
    set onFail(fn: (() => void) | null) { _onFail = fn; },
    async getGist(id: string) {
      calls.getGist.push([id]);
      const files: Record<string, any> = {};
      Object.entries(_files).forEach(([k, v]) => {
        files[k] = { content: typeof v === 'string' ? v : JSON.stringify(v) };
      });
      return { id, files };
    },
    async updateGist(id: string, files: Record<string, any>) {
      if (_failNext > 0) {
        _failNext--;
        if (_onFail) _onFail();
        throw new Error('network error');
      }
      Object.entries(files).forEach(([k, v]) => {
        if (v === null) delete _files[k];
        else _files[k] = v.content;
      });
      calls.updateGist.push([id, files]);
    },
    async deleteFile(id: string, filename: string) {
      delete _files[filename];
      calls.deleteFile.push([id, filename]);
    },
    async listGists() {
      return [{ id: 'gist-123', description: 'gistdb:app' }];
    },
    async createGist() {
      return 'gist-123';
    },
  };
}

describe('GistTransport', () => {
  test('putFile() chama updateGist com filename e content', async () => {
    const api = makeMockApi();
    const transport = new GistTransport(api, { retries: 2, timeout: 5000 });
    transport.setGistId('gist-123');
    await transport.putFile('gistdb_app_todos_1.json', { titulo: 'x' });
    expect(api.calls.updateGist.length).toBe(1);
    const [, files] = api.calls.updateGist[0];
    expect(Object.prototype.hasOwnProperty.call(files, 'gistdb_app_todos_1.json')).toBe(true);
  });

  test('getFile() retorna null para arquivo inexistente', async () => {
    const api = makeMockApi({});
    const transport = new GistTransport(api, { retries: 2, timeout: 5000 });
    transport.setGistId('gist-123');
    const r = await transport.getFile('nao-existe.json');
    expect(r).toBeNull();
  });

  test('getFile() parseia JSON corretamente', async () => {
    const data = { _id: '1', titulo: 'olá' };
    const api = makeMockApi({ 'f.json': JSON.stringify(data) });
    const transport = new GistTransport(api, { retries: 2, timeout: 5000 });
    transport.setGistId('gist-123');
    const r = await transport.getFile('f.json');
    expect(r.titulo).toBe('olá');
  });

  test('deleteFile() chama deleteFile na API', async () => {
    const api = makeMockApi();
    const transport = new GistTransport(api, { retries: 2, timeout: 5000 });
    transport.setGistId('gist-123');
    await transport.deleteFile('arquivo.json');
    expect(api.calls.deleteFile.length).toBe(1);
  });

  test('listFiles() filtra por collection corretamente', async () => {
    const files = {
      'gistdb_app_todos_1.json': JSON.stringify({ _id: '1' }),
      'gistdb_app_todos_2.json': JSON.stringify({ _id: '2' }),
      'gistdb_app_users_1.json': JSON.stringify({ _id: 'u1' }),
    };
    const api = makeMockApi(files);
    const transport = new GistTransport(api, { retries: 2, timeout: 5000 });
    transport.setGistId('gist-123');
    const todos = await transport.listFiles('todos');
    expect(todos.length).toBe(2);
  });

  test('retry: tenta novamente após falha de rede', async () => {
    let tentativas = 0;
    const api = makeMockApi();
    api.failNext = 1;
    api.onFail = () => tentativas++;
    const transport = new GistTransport(api, { retries: 2, timeout: 5000 });
    transport.setGistId('gist-123');
    await transport.putFile('f.json', { x: 1 });
    expect(tentativas).toBe(1);
    expect(api.calls.updateGist.length).toBe(1);
  });

  test('initGist(true): reaproveita gist existente se encontrado (autoConnect)', async () => {
    const api = makeMockApi();
    const transport = new GistTransport(api, { retries: 2, timeout: 5000 });
    const id = await transport.initGist(true);
    expect(id).toBe('gist-123');
  });

  test('initGist(false): ignora gists existentes e cria um novo', async () => {
    let criouGist = false;
    const api = makeMockApi();
    api.createGist = async () => {
      criouGist = true;
      return 'gist-novo-456';
    };
    const transport = new GistTransport(api, { retries: 2, timeout: 5000 });
    const id = await transport.initGist(false);
    expect(criouGist).toBe(true);
    expect(id).toBe('gist-novo-456');
  });
});
