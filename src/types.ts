/**
 * types.ts — Contratos e definições de tipos para o GistDB SDK.
 */


export interface GistDBConfig {
  /** GitHub Personal Access Token */
  token: string;
  /** Prefixo opcional para isolar chaves no Gist */
  prefix?: string;
  /** ID opcional do Gist se já existente */
  gistId?: string;
  /** Criptografia ativada (padrão: false) */
  encryption?: boolean;
  /** Senha para criptografia AES-GCM (obrigatório se encryption for true) */
  password?: string;
  /** Callback opcional de logs */
  logger?: (msg: string) => void;
  /** Estratégia de resolução de conflitos */
  /** Descoberta automática de Gist pelo prefixo se gistId omitido (padrão: true) */
  autoConnect?: boolean;
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
  value: T;
  version: string;
  timestamp: number;
}

export interface TransportPayload {
  key: string;
  value: any;
  version: string;
  timestamp: number;
  action: 'set' | 'delete';
}

export interface CryptoPayload {
  cipher: string;
  iv: string;
}
