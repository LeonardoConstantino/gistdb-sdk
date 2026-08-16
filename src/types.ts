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
  conflictResolver?: 'last-write-wins' | 'merge' | ((local: any, remote: any) => any);
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
