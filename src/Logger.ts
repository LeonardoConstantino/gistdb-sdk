export type LogLevel = 'none' | 'error' | 'warn' | 'info' | 'debug';

export interface LogRecord {
  ts: string;
  module: string;
  level: LogLevel;
  message: string;
  traceId?: string;
  durationMs?: number;
  meta?: any;
}

export type LogHandler = (record: LogRecord) => void;

const LEVELS: Record<LogLevel, number> = {
  none: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
};

function sanitize(obj: any): any {
  if (!obj || typeof obj !== 'object') {
    if (typeof obj === 'string') {
      return obj.replace(/(ghp_[A-Za-z0-9_]{36,}|github_pat_[A-Za-z0-9_]{22,}_[A-Za-z0-9_]{59})/g, '[REDACTED_TOKEN]');
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitize);
  }

  const clean: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (lowerKey.includes('token') || lowerKey.includes('password') || lowerKey.includes('secret')) {
      clean[key] = '[REDACTED]';
    } else {
      clean[key] = sanitize(val);
    }
  }
  return clean;
}

class LoggerClass {
  private enabled = false;
  private level: LogLevel = 'warn';
  private handlers = new Set<LogHandler>();
  private activeTimers = new Map<string, number>();

  enable(level: LogLevel = 'debug') {
    this.enabled = true;
    this.level = level;
  }

  disable() {
    this.enabled = false;
  }

  isEnabled() {
    return this.enabled;
  }

  setLevel(level: LogLevel) {
    this.level = level;
  }

  subscribe(handler: LogHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  clearSubscribers() {
    this.handlers.clear();
  }

  createTraceId(): string {
    return 'tr_' + Math.random().toString(36).substring(2, 9);
  }

  time(label: string) {
    this.activeTimers.set(label, Date.now());
  }

  timeEnd(module: string, label: string, message: string, meta?: any): number | undefined {
    const start = this.activeTimers.get(label);
    if (!start) return undefined;
    const durationMs = Date.now() - start;
    this.activeTimers.delete(label);
    this.info(module, `${message} (${durationMs}ms)`, { ...meta, durationMs });
    return durationMs;
  }

  private shouldLog(lvl: LogLevel) {
    if (this.handlers.size > 0) return true;
    if (!this.enabled) return false;
    return LEVELS[lvl] <= LEVELS[this.level];
  }

  private emit(record: LogRecord) {
    const sanitizedRecord = {
      ...record,
      message: sanitize(record.message),
      meta: record.meta !== undefined ? sanitize(record.meta) : undefined,
    };

    // Notifica os handlers customizados (subscribers)
    this.handlers.forEach((h) => {
      try {
        h(sanitizedRecord);
      } catch {}
    });

    // Output para console apenas se habilitado ativamente e dentro do nível configurado
    if (this.enabled && LEVELS[record.level] <= LEVELS[this.level]) {
      const json = JSON.stringify(sanitizedRecord);
      switch (record.level) {
        case 'error':
          console.error(json);
          break;
        case 'warn':
          console.warn(json);
          break;
        case 'info':
          console.info(json);
          break;
        case 'debug':
          console.debug(json);
          break;
      }
    }
  }

  error(module: string, message: string, meta?: any, traceId?: string) {
    if (!this.shouldLog('error')) return;
    this.emit({ ts: new Date().toISOString(), module, level: 'error', message, meta, traceId });
  }

  warn(module: string, message: string, meta?: any, traceId?: string) {
    if (!this.shouldLog('warn')) return;
    this.emit({ ts: new Date().toISOString(), module, level: 'warn', message, meta, traceId });
  }

  info(module: string, message: string, meta?: any, traceId?: string) {
    if (!this.shouldLog('info')) return;
    this.emit({ ts: new Date().toISOString(), module, level: 'info', message, meta, traceId });
  }

  debug(module: string, message: string, meta?: any, traceId?: string) {
    if (!this.shouldLog('debug')) return;
    this.emit({ ts: new Date().toISOString(), module, level: 'debug', message, meta, traceId });
  }
}

export const Logger = new LoggerClass();

try {
  // @ts-ignore
  const g = typeof globalThis !== 'undefined' ? (globalThis as any) : null;
  if (g && g.__GISTDB_DEBUG_LEVEL) {
    // @ts-ignore
    Logger.enable(g.__GISTDB_DEBUG_LEVEL as LogLevel);
  }
} catch (e) {}
