/**
 * ConflictResolver — estratégias de merge para conflitos multi-dispositivo.
 *
 * Estratégias built-in:
 *   'last-write-wins' — quem tem _updatedAt mais recente vence (padrão)
 *   'remote-wins'     — dados do Gist sempre prevalecem
 *   'local-wins'      — dados locais sempre prevalecem
 *   'custom'          — função fornecida pelo usuário
 */
export class ConflictResolver {
  #strategy;
  #customFn;

  constructor(strategy = 'last-write-wins', customFn = null) {
    const valid = ['last-write-wins', 'remote-wins', 'local-wins', 'custom'];
    if (!valid.includes(strategy)) {
      throw new Error(`ConflictResolver: estratégia inválida "${strategy}".`);
    }
    if (strategy === 'custom' && typeof customFn !== 'function') {
      throw new Error(
        'ConflictResolver: forneça customFn para strategy="custom".',
      );
    }
    this.#strategy = strategy;
    this.#customFn = customFn;
  }

  /**
   * @param {object} local    - dado local (o que o usuário quer salvar)
   * @param {object} remote   - dado remoto (o que está no Gist)
   * @param {object} meta     - { version }
   * @returns {object}        - objeto resolvido
   */
  resolve(local, remote, meta = {}) {
    if (!remote) return local;
    if (!local) return remote;

    switch (this.#strategy) {
      case 'last-write-wins': {
        const localTime = new Date(local._updatedAt ?? 0).getTime();
        const remoteTime = new Date(remote._updatedAt ?? 0).getTime();
        return localTime >= remoteTime ? local : remote;
      }

      case 'remote-wins':
        return remote;

      case 'local-wins':
        return local;

      case 'custom':
        return this.#customFn(local, remote, meta);

      default:
        return local;
    }
  }
}
