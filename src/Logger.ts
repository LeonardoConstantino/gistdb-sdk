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
      return obj.replace(
        /(ghp_[A-Za-z0-9_]{36,}|github_pat_[A-Za-z0-9_]{22,}_[A-Za-z0-9_]{59})/g,
        '[REDACTED_TOKEN]',
      );
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitize);
  }

  const clean: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (
      lowerKey.includes('token') ||
      lowerKey.includes('password') ||
      lowerKey.includes('secret')
    ) {
      clean[key] = '[REDACTED]';
    } else {
      clean[key] = sanitize(val);
    }
  }
  return clean;
}

// ─── Detecção de ambiente ───────────────────────────────────────────────────

const isNode = typeof process !== 'undefined' && process.stdout != null;
const isTTY = isNode && process.stdout?.isTTY;
const isBrowser = typeof window !== 'undefined';

// ─── Estilos ANSI (Node TTY) ────────────────────────────────────────────────

const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  white: '\x1b[97m',
} as const;

const LEVEL_ANSI: Record<LogLevel, { color: string; badge: string }> = {
  none: { color: '', badge: '      ' },
  error: { color: ANSI.red, badge: ' ERR  ' },
  warn: { color: ANSI.yellow, badge: ' WARN ' },
  info: { color: ANSI.cyan, badge: ' INFO ' },
  debug: { color: ANSI.gray, badge: ' DBG  ' },
};

function colorize(color: string, text: string): string {
  return isTTY ? `${color}${text}${ANSI.reset}` : text;
}

// ─── Estilos CSS (Navegador) ─────────────────────────────────────────────────

const LEVEL_CSS: Record<
  LogLevel,
  { badge: string; badgeCSS: string; msgCSS: string }
> = {
  none: { badge: '      ', badgeCSS: '', msgCSS: '' },
  error: {
    badge: ' ERR  ',
    badgeCSS:
      'background:#e53e3e;color:#fff;font-weight:bold;border-radius:3px;padding:1px 4px',
    msgCSS: 'color:#e53e3e;font-weight:bold',
  },
  warn: {
    badge: ' WARN ',
    badgeCSS:
      'background:#d69e2e;color:#fff;font-weight:bold;border-radius:3px;padding:1px 4px',
    msgCSS: 'color:#b7791f;font-weight:bold',
  },
  info: {
    badge: ' INFO ',
    badgeCSS:
      'background:#3182ce;color:#fff;font-weight:bold;border-radius:3px;padding:1px 4px',
    msgCSS: 'color:#2b6cb0',
  },
  debug: {
    badge: ' DBG  ',
    badgeCSS:
      'background:#718096;color:#fff;font-weight:bold;border-radius:3px;padding:1px 4px',
    msgCSS: 'color:#718096',
  },
};

const CSS = {
  dim: 'color:#a0aec0;font-size:0.85em',
  mod: 'color:#888;font-weight:600',
  meta: 'color:#718096;font-size:0.85em',
} as const;

// ─── Formatters ──────────────────────────────────────────────────────────────

function formatNode(record: LogRecord): string {
  const { color, badge } = LEVEL_ANSI[record.level];
  const time = colorize(ANSI.dim, record.ts.slice(11, 23));
  const lvl = colorize(ANSI.bold + color, badge);
  const mod = colorize(ANSI.white, `[${record.module}]`);
  const msg = colorize(color, record.message);
  const trace = record.traceId
    ? colorize(ANSI.dim, ` trace=${record.traceId}`)
    : '';
  const dur =
    record.durationMs != null
      ? colorize(ANSI.dim, ` +${record.durationMs}ms`)
      : '';

  let line = `${time} ${lvl} ${mod} ${msg}${trace}${dur}`;

  if (record.meta !== undefined) {
    const metaStr = JSON.stringify(record.meta, null, 2)
      .split('\n')
      .map((l, i) => colorize(ANSI.dim, (i === 0 ? '  ↳ ' : '    ') + l))
      .join('\n');
    line += '\n' + metaStr;
  }

  return line;
}

// Retorna [formatString, ...substitutions] prontos para console.log(...args)
function formatBrowser(record: LogRecord): [string, ...string[]] {
  const { badge, badgeCSS, msgCSS } = LEVEL_CSS[record.level];
  const time  = record.ts.slice(11, 23);
  const trace = record.traceId       ? `  trace=${record.traceId}`      : '';
  const dur   = record.durationMs != null ? `  +${record.durationMs}ms` : '';

  const fmt = `%c${time} %c${badge}%c [${record.module}] %c${record.message}${trace}${dur}`;
  //           ↑ dim     ↑ badge     ↑ mod               ↑ msg  — 4 %c, 4 estilos
  const args: [string, ...string[]] = [fmt, CSS.dim, badgeCSS, CSS.mod, msgCSS];

  return args;
}

// ─── Entry point unificado ───────────────────────────────────────────────────

function consoleOutput(record: LogRecord): void {
  const fn = {
    error: console.error,
    warn: console.warn,
    info: console.info,
    debug: console.debug,
    none: console.log,
  }[record.level];

  if (isBrowser) {
    const [fmt, ...styles] = formatBrowser(record);
    fn(fmt, ...styles);
    if (record.meta !== undefined)
      console.debug('%cmeta', CSS.meta, record.meta);
    return;
  }

  fn(formatNode(record));
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

  timeEnd(
    module: string,
    label: string,
    message: string,
    meta?: any,
  ): number | undefined {
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

    this.handlers.forEach((h) => {
      try {
        h(sanitizedRecord);
      } catch {}
    });

    if (this.enabled && LEVELS[record.level] <= LEVELS[this.level]) {
      consoleOutput(sanitizedRecord); // ← única mudança
    }
  }

  error(module: string, message: string, meta?: any, traceId?: string) {
    if (!this.shouldLog('error')) return;
    this.emit({
      ts: new Date().toISOString(),
      module,
      level: 'error',
      message,
      meta,
      traceId,
    });
  }

  warn(module: string, message: string, meta?: any, traceId?: string) {
    if (!this.shouldLog('warn')) return;
    this.emit({
      ts: new Date().toISOString(),
      module,
      level: 'warn',
      message,
      meta,
      traceId,
    });
  }

  info(module: string, message: string, meta?: any, traceId?: string) {
    if (!this.shouldLog('info')) return;
    this.emit({
      ts: new Date().toISOString(),
      module,
      level: 'info',
      message,
      meta,
      traceId,
    });
  }

  debug(module: string, message: string, meta?: any, traceId?: string) {
    if (!this.shouldLog('debug')) return;
    this.emit({
      ts: new Date().toISOString(),
      module,
      level: 'debug',
      message,
      meta,
      traceId,
    });
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
