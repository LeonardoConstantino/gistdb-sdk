/**
 * types.ts — Contratos e definições de tipos para o GistDB SDK.
 */

export interface GistDBConfig {
  /** GitHub Personal Access Token (obrigatório) */
  token: string;
  /** Prefixo para isolar chaves no Gist (obrigatório) */
  prefix: string;
  /** ID opcional do Gist se já existente */
  gistId?: string | null;
  /** Senha para criptografia AES-GCM (opcional) */
  password?: string;
  /** Esquema de validação por collection */
  schema?: Record<string, (data: any) => boolean>;
  /** Estratégia de resolução de conflitos */
  conflictResolver?:
    | 'last-write-wins'
    | 'merge'
    | ((local: any, remote: any) => any);
  /** TTL do cache local em milissegundos */
  ttl?: number;
  /** Descoberta automática de Gist pelo prefixo se gistId for omitido (padrão: true) */
  autoConnect?: boolean;
  /** Sincronização automática orientada a eventos do ciclo de vida da janela */
  autoSync?:
    | boolean
    | {
        onFocus?: boolean;
        onReconnect?: boolean;
        onUnload?: boolean;
      };
  /** Nome amigável do dispositivo atual (opcional) */
  deviceName?: string;
}

export interface DeviceInfo {
  id: string;
  name: string;
  platform: string;
  lastSeenAt: string;
  isCurrent?: boolean;
}

export interface CacheEntry<T = any> {
  data: T;
  version: string;
  cachedAt: number;
}

export interface TransportPayload {
  key: string;
  value: any;
  version: string;
  timestamp: number;
  action: 'set' | 'delete';
}

export interface EncryptedPayload {
  __encrypted: true;
  iv: string;
  ciphertext: string;
  salt: string;
}

