import { z } from 'zod';
import type { LogLevel } from './lib/logger';

/** The only place that reads `process.env` (rule B22). Parsed once at boot. Invalid config crashes. */
const Env = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.url(),
  /** The site origin. Mutating requests must come from it (rule F12). */
  PUBLIC_ORIGIN: z.url().default('http://localhost:4321'),
  /** Comma-separated proxy IPs/CIDRs to trust for X-Forwarded-For (rule F10). Empty: trust none. */
  TRUST_PROXY: z.string().default(''),
});

export type Config = {
  env: 'development' | 'test' | 'production';
  host: string;
  port: number;
  logLevel: LogLevel;
  databaseUrl: string;
  publicOrigin: string;
  trustProxy: string[];
};

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const parsed = Env.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Invalid environment configuration:\n${z.prettifyError(parsed.error)}`);
  }
  const e = parsed.data;
  return {
    env: e.NODE_ENV,
    host: e.HOST,
    port: e.PORT,
    logLevel: e.LOG_LEVEL,
    databaseUrl: e.DATABASE_URL,
    publicOrigin: e.PUBLIC_ORIGIN,
    trustProxy: e.TRUST_PROXY.split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  };
}
