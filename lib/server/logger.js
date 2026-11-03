// Server logs: JSON on stdout in production (what any host or log collector picks up),
// readable text in dev. No pino transports: their worker thread doesn't suit serverless hosts.
import pino from 'pino';

// Masked at the top level and one level down, wherever they appear in a log object.
const SECRET_KEYS = ['password', 'passwordHash', 'newPassword', 'token', 'resetToken', 'credential', 'authorization', 'cookie', 'secret'];

export function createLogger(stream) {
  return pino(
    {
      level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
      base: null,
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: { level: (label) => ({ level: label }) },
      // `code` only at the top level: err.code (ECONNREFUSED and so on) has to stay readable.
      redact: { paths: [...SECRET_KEYS, ...SECRET_KEYS.map((k) => `*.${k}`), 'code'], censor: '[redacted]' },
    },
    stream
  );
}

const pretty = process.env.NODE_ENV !== 'production' && (await import('pino-pretty')).default({ sync: true });

export const logger = createLogger(pretty || undefined);
