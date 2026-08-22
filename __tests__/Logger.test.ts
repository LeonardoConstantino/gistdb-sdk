import { describe, test, expect, beforeEach } from '@jest/globals';
import { Logger, LogRecord } from '../src/Logger.js';

describe('Logger (Observabilidade)', () => {
  beforeEach(() => {
    Logger.disable();
    Logger.clearSubscribers();
  });

  test('subscribers recebem registros de log estruturados', () => {
    const logs: LogRecord[] = [];
    Logger.subscribe((rec) => logs.push(rec));
    Logger.enable('info');

    Logger.info('TestModule', 'Mensagem de teste', { key: 'val' });

    expect(logs.length).toBe(1);
    expect(logs[0].module).toBe('TestModule');
    expect(logs[0].level).toBe('info');
    expect(logs[0].message).toBe('Mensagem de teste');
    expect(logs[0].meta?.key).toBe('val');
  });

  test('sanitiza tokens e senhas no meta e nas mensagens', () => {
    const logs: LogRecord[] = [];
    Logger.subscribe((rec) => logs.push(rec));
    Logger.enable('debug');

    Logger.info('Auth', 'Usando ghp_1234567890abcdefghijklmnopqrstuvwxyz123456', {
      token: 'ghp_secret_token_123',
      password: 'minha_senha_secreta',
      normalField: 'ok',
    });

    expect(logs[0].message).toContain('[REDACTED_TOKEN]');
    expect(logs[0].meta.token).toBe('[REDACTED]');
    expect(logs[0].meta.password).toBe('[REDACTED]');
    expect(logs[0].meta.normalField).toBe('ok');
  });

  test('time() e timeEnd() calculam durationMs', async () => {
    const logs: LogRecord[] = [];
    Logger.subscribe((rec) => logs.push(rec));

    Logger.time('op1');
    await new Promise((r) => setTimeout(r, 20));
    const duration = Logger.timeEnd('DB', 'op1', 'Operação concluída');

    expect(typeof duration).toBe('number');
    expect(duration).toBeGreaterThanOrEqual(15);
    expect(logs[0].meta?.durationMs).toBe(duration);
  });

  test('createTraceId gera id com prefixo tr_', () => {
    const traceId = Logger.createTraceId();
    expect(traceId.startsWith('tr_')).toBe(true);
  });
});
