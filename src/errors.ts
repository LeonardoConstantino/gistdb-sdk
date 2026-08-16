/**
 * errors.ts — classes de erro tipadas do GistDB.
 *
 * Permite que o caller distinga erros com instanceof
 * ou pelo campo .code.
 */

export type ErrorCode =
  | 'TOKEN_REQUIRED'
  | 'PREFIX_REQUIRED'
  | 'NOT_INITIALIZED'
  | 'VALIDATION_ERROR'
  | 'RATE_LIMITED'
  | 'API_ERROR'
  | 'NO_TOKEN'
  | 'DECRYPT_FAILED';

export class GistDBError extends Error {
  public readonly code: ErrorCode;

  constructor(code: ErrorCode, message: string) {
    super(message);
    this.name = 'GistDBError';
    this.code = code;
    Object.setPrototypeOf(this, GistDBError.prototype);
  }
}

export const ERROR_CODES: Record<ErrorCode, ErrorCode> = {
  TOKEN_REQUIRED: 'TOKEN_REQUIRED',
  PREFIX_REQUIRED: 'PREFIX_REQUIRED',
  NOT_INITIALIZED: 'NOT_INITIALIZED',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
  API_ERROR: 'API_ERROR',
  NO_TOKEN: 'NO_TOKEN',
  DECRYPT_FAILED: 'DECRYPT_FAILED',
};
