export type LogLevel = 'none' | 'error' | 'warn' | 'info' | 'debug';

const LEVELS: Record<LogLevel, number> = {
  none: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
};

class LoggerClass {
  private enabled = false;
  private level: LogLevel = 'warn';

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

  private shouldLog(lvl: LogLevel) {
    if (!this.enabled) return false;
    return LEVELS[lvl] <= LEVELS[this.level];
  }

  private fmt(module: string, level: LogLevel, message: string, meta?: any) {
    const out: any = {
      ts: new Date().toISOString(),
      module,
      level,
      message,
    };
    if (meta !== undefined) out.meta = meta;
    return out;
  }

  error(module: string, message: string, meta?: any) {
    if (!this.shouldLog('error')) return;
    console.error(JSON.stringify(this.fmt(module, 'error', message, meta)));
  }
  warn(module: string, message: string, meta?: any) {
    if (!this.shouldLog('warn')) return;
    console.warn(JSON.stringify(this.fmt(module, 'warn', message, meta)));
  }
  info(module: string, message: string, meta?: any) {
    if (!this.shouldLog('info')) return;
    console.info(JSON.stringify(this.fmt(module, 'info', message, meta)));
  }
  debug(module: string, message: string, meta?: any) {
    if (!this.shouldLog('debug')) return;
    console.debug(JSON.stringify(this.fmt(module, 'debug', message, meta)));
  }
}

export const Logger = new LoggerClass();

// Optional automatic enabling via global flag for quick dev use
try {
  // @ts-ignore
  const g = typeof globalThis !== 'undefined' ? (globalThis as any) : null;
  if (g && g.__GISTDB_DEBUG_LEVEL) {
    // @ts-ignore
    Logger.enable(g.__GISTDB_DEBUG_LEVEL as LogLevel);
  }
} catch (e) {}
