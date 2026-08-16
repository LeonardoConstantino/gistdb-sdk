/**
 * ConflictResolver — estratégias de merge para conflitos multi-dispositivo.
 */

export type ConflictStrategy = 'last-write-wins' | 'remote-wins' | 'local-wins' | 'merge' | 'custom';

export class ConflictResolver {
  #strategy: ConflictStrategy;
  #customFn: ((local: any, remote: any, meta: any) => any) | null;

  constructor(
    strategy: ConflictStrategy | ((local: any, remote: any, meta: any) => any) = 'last-write-wins'
  ) {
    if (typeof strategy === 'function') {
      this.#strategy = 'custom';
      this.#customFn = strategy;
    } else {
      const valid: ConflictStrategy[] = ['last-write-wins', 'remote-wins', 'local-wins', 'merge', 'custom'];
      if (!valid.includes(strategy)) {
        throw new Error(`ConflictResolver: estratégia inválida "${strategy}".`);
      }
      this.#strategy = strategy;
      this.#customFn = null;
    }
  }

  /**
   * Resolve o conflito de dados.
   */
  resolve(local: any, remote: any, meta: any = {}): any {
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

      case 'merge':
        return { ...remote, ...local };

      case 'local-wins':
        return local;

      case 'custom':
        if (this.#customFn) {
          return this.#customFn(local, remote, meta);
        }
        return local;

      default:
        return local;
    }
  }
}
