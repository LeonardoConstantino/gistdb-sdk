export type ConflictStrategy =
  | 'last-write-wins'
  | 'remote-wins'
  | 'local-wins'
  | 'merge'
  | 'custom';

export type ConflictMeta = {
  timestampKey?: string; // campo usado em last-write-wins (default: '_updatedAt')
  [key: string]: unknown;
};

type Versioned = { [key: string]: unknown };
type CustomFn<T> = (local: T, remote: T, meta: ConflictMeta) => T;

const VALID_STRATEGIES: ConflictStrategy[] = [
  'last-write-wins',
  'remote-wins',
  'local-wins',
  'merge',
  'custom',
];

export class ConflictResolver<T extends Versioned = Versioned> {
  #strategy: ConflictStrategy;
  #customFn: CustomFn<T> | null;

  constructor(strategy: ConflictStrategy | CustomFn<T> = 'last-write-wins') {
    if (typeof strategy === 'function') {
      this.#strategy = 'custom';
      this.#customFn = strategy;
      return;
    }

    if (!VALID_STRATEGIES.includes(strategy)) {
      throw new Error(`ConflictResolver: estratégia inválida "${strategy}".`);
    }

    this.#strategy = strategy;
    this.#customFn = null;
  }

  resolve(local: T | null, remote: T | null, meta: ConflictMeta = {}): T {
    if (!remote) return local!;
    if (!local) return remote;

    switch (this.#strategy) {
      case 'last-write-wins': {
        const key = meta.timestampKey ?? '_updatedAt';
        const localTime = new Date((local[key] as string) ?? 0).getTime();
        const remoteTime = new Date((remote[key] as string) ?? 0).getTime();
        return localTime >= remoteTime ? local : remote;
      }

      case 'remote-wins':
        return remote;

      case 'local-wins':
        return local;

      case 'merge':
        // remote como base, local sobrescreve — "local tem prioridade nos conflitos"
        // inverta a ordem se quiser semântica oposta
        return { ...remote, ...local };

      case 'custom':
        return this.#customFn!(local, remote, meta);
    }
  }

  get strategy(): ConflictStrategy {
    return this.#strategy;
  }
}