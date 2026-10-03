const LEVELS = ['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'] as const;
export type LogLevel = (typeof LEVELS)[number];

/** The quieter of two levels: `atLeast('debug', 'warn')` is 'warn', `atLeast('silent', 'warn')` is 'silent'. */
export function atLeast(level: LogLevel, min: LogLevel): LogLevel {
  return LEVELS.indexOf(level) >= LEVELS.indexOf(min) ? level : min;
}

/**
 * The logger shape services depend on. Fastify's pino logger satisfies it, but services
 * never import Fastify (rule B4), so this type stands in for it.
 */
type LogFn = {
  (obj: object, msg?: string): void;
  (msg: string): void;
};

export type Logger = {
  debug: LogFn;
  info: LogFn;
  warn: LogFn;
  error: LogFn;
  child(bindings: Record<string, unknown>): Logger;
};
