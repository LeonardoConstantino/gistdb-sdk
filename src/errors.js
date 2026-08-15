/**
 * errors.js — classes de erro tipadas do GistDB.
 *
 * Permite que o caller distinga erros com instanceof
 * ou pelo campo .code.
 */
export class GistDBError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'GistDBError';
    this.code = code;
  }
}

export const ERROR_CODES = {
  TOKEN_REQUIRED: 'TOKEN_REQUIRED',
  PREFIX_REQUIRED: 'PREFIX_REQUIRED',
  NOT_INITIALIZED: 'NOT_INITIALIZED',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
  API_ERROR: 'API_ERROR',
  NO_TOKEN: 'NO_TOKEN',
  DECRYPT_FAILED: 'DECRYPT_FAILED',
};
