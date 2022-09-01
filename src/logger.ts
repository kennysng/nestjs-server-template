import pino from 'pino';

// REMARK use any as pino.LoggerOptions fail due to private interface redactOptions
export default (name?: string, options: any = {}) =>
  pino({ ...options, name, level: process.env.PINO_LOG_LEVEL || 'info' });
