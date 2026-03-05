/**
 * Structured logger with PII redaction for Colourmap API routes.
 * Never log raw email, names, or message content.
 */

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
function redactPii(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === 'string') {
    return value.replace(EMAIL_RE, '[email]').slice(0, 256) + (value.length > 256 ? '…' : '');
  }
  if (Array.isArray(value)) return value.map(redactPii);
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      const lower = k.toLowerCase();
      if (
        lower.includes('email') ||
        lower.includes('name') ||
        lower === 'message' ||
        lower === 'content' ||
        lower === 'body'
      ) {
        out[k] = '[redacted]';
      } else {
        out[k] = redactPii(v);
      }
    }
    return out;
  }
  return value;
}

export type LogLevel = 'info' | 'warn' | 'error';

export type LogMeta = Record<string, unknown>;

function write(level: LogLevel, message: string, meta?: LogMeta, traceId?: string) {
  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(traceId && { traceId }),
    ...(meta && Object.keys(meta).length > 0 && { meta: redactPii(meta) }),
  };
  const line = JSON.stringify(entry);
  if (level === 'error') {
    process.stderr.write(`${line}\n`);
  } else {
    process.stdout.write(`${line}\n`);
  }
}

export function createLogger(getTraceId?: () => string | undefined) {
  return {
    info(message: string, meta?: LogMeta) {
      write('info', message, meta, getTraceId?.());
    },
    warn(message: string, meta?: LogMeta) {
      write('warn', message, meta, getTraceId?.());
    },
    error(message: string, meta?: LogMeta) {
      write('error', message, meta, getTraceId?.());
    },
  };
}

/** Default logger for API routes. */
export const logger = createLogger();

/** Extract trace ID from request headers (Vercel, etc.) */
export function getTraceId(request: Request): string | undefined {
  return request.headers.get('x-vercel-id') ?? undefined;
}
