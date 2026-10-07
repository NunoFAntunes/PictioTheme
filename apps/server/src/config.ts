import { z } from 'zod';
import type { LogLevel } from './lib/logger';

/** The only place that reads `process.env` (rule B22). Parsed once at boot. Invalid config crashes. */
/**
 * Picked by the theme-check eval (model-eval-2026-10.md#theme-check): the deck model was the most
 * accurate and, per check, already among the cheapest (~$0.0001). `openai/gpt-oss-20b` is the
 * cheap option (~3.5× less, but misses more themes in the wrong language).
 */
const THEME_CHECK_DEFAULT_MODEL = 'openai/gpt-6-luna';

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
  /** Signs guest cookies and WebSocket join tokens. At least 32 random characters. */
  SESSION_SECRET: z.string().min(32),
  /** HTTP rate limits. Only turned off for automated tests. */
  RATE_LIMITS: z.enum(['on', 'off']).default('on'),
  /**
   * Lets players generate decks in the app. On by default, guests included, within the limits
   * below (docs/planning/next-features.md 1.6). `off` is the kill switch.
   */
  DECK_GENERATION: z.enum(['on', 'off']).default('on'),
  /** The generation limits below. Only turned off for automated tests and local development. */
  GENERATION_LIMITS: z.enum(['on', 'off']).default('on'),
  /** Decks one player can generate in any 24 hours. Failed generations don't count. */
  GENERATION_PER_PLAYER_PER_DAY: z.coerce.number().int().min(0).default(1),
  /** Decks one IP can generate in any 24 hours (several guests can share a network). */
  GENERATION_PER_IP_PER_DAY: z.coerce.number().int().min(0).default(3),
  /**
   * Deck translations one player / one IP can start in any 24 hours. Translations are shared (the
   * next room in that language reuses them) and cheaper than a new deck, so these are higher.
   */
  GENERATION_TRANSLATIONS_PER_PLAYER_PER_DAY: z.coerce.number().int().min(0).default(5),
  GENERATION_TRANSLATIONS_PER_IP_PER_DAY: z.coerce.number().int().min(0).default(15),
  /**
   * Theme checks one player / one IP may fail in any 24 hours (a theme in the wrong language, too
   * unclear, or refused). Refused themes never become jobs, so without this cap they'd cost model
   * calls without limit.
   */
  GENERATION_REFUSED_CHECKS_PER_PLAYER_PER_DAY: z.coerce.number().int().min(0).default(20),
  GENERATION_REFUSED_CHECKS_PER_IP_PER_DAY: z.coerce.number().int().min(0).default(60),
  /**
   * What all generations, translations and theme checks together may cost in any 24 hours, in
   * USD. Then: "busy, try later".
   */
  GENERATION_DAILY_BUDGET_USD: z.coerce.number().min(0).default(5),
  /** OpenRouter key for AI deck generation. Empty: generation is unavailable. */
  OPENROUTER_API_KEY: z.string().default(''),
  /**
   * OpenRouter model slug for deck generation (exact slug from openrouter.ai/models).
   * Chosen by the model eval: docs/technical/model-eval-2026-10.md.
   */
  DECK_MODEL: z.string().min(1).default('openai/gpt-6-luna'),
  /** Comma-separated slugs OpenRouter falls back to when the primary model fails. */
  DECK_FALLBACK_MODELS: z.string().default('openai/gpt-6-luna-pro'),
  /**
   * Only route to providers that support every request parameter, so the JSON schema is
   * enforced. Turn off for models without structured-output support (output is validated anyway).
   */
  DECK_REQUIRE_PARAMETERS: z.enum(['on', 'off']).default('on'),
  /**
   * OpenRouter model for the theme check (ai-deck-pipeline.md#theme-check), apart from the deck
   * model so it can be switched to a cheaper one, e.g. `openai/gpt-oss-20b`. Compare models with
   * `pnpm --filter @pictiotheme/server theme-check:eval`.
   */
  THEME_CHECK_MODEL: z.string().min(1).default(THEME_CHECK_DEFAULT_MODEL),
  /**
   * Comma-separated slugs OpenRouter falls back to when the theme-check model fails. Empty: the
   * deck model and its fallbacks (minus the check model itself).
   */
  THEME_CHECK_FALLBACK_MODELS: z.string().default(''),
});

export type Config = {
  env: 'development' | 'test' | 'production';
  host: string;
  port: number;
  logLevel: LogLevel;
  databaseUrl: string;
  publicOrigin: string;
  trustProxy: string[];
  sessionSecret: string;
  /** Cookies get the Secure flag outside development and tests. */
  secureCookies: boolean;
  rateLimits: boolean;
  /** Whether players can generate decks in the app (`DECK_GENERATION`). */
  deckGeneration: boolean;
  /** Null when `GENERATION_LIMITS=off`. */
  generationLimits: GenerationLimits | null;
  openRouter: {
    /** Null when no key is configured: deck generation then fails with SERVICE_UNAVAILABLE. */
    apiKey: string | null;
    deckModel: string;
    fallbackModels: string[];
    requireParameters: boolean;
    themeCheckModel: string;
    themeCheckFallbackModels: string[];
  };
};

export type GenerationLimits = {
  perPlayerPerDay: number;
  perIpPerDay: number;
  translationsPerPlayerPerDay: number;
  translationsPerIpPerDay: number;
  refusedChecksPerPlayerPerDay: number;
  refusedChecksPerIpPerDay: number;
  dailyBudgetUsd: number;
};

function splitList(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

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
    trustProxy: splitList(e.TRUST_PROXY),
    sessionSecret: e.SESSION_SECRET,
    secureCookies: e.NODE_ENV === 'production',
    rateLimits: e.RATE_LIMITS === 'on',
    deckGeneration: e.DECK_GENERATION === 'on',
    generationLimits:
      e.GENERATION_LIMITS === 'on'
        ? {
            perPlayerPerDay: e.GENERATION_PER_PLAYER_PER_DAY,
            perIpPerDay: e.GENERATION_PER_IP_PER_DAY,
            translationsPerPlayerPerDay: e.GENERATION_TRANSLATIONS_PER_PLAYER_PER_DAY,
            translationsPerIpPerDay: e.GENERATION_TRANSLATIONS_PER_IP_PER_DAY,
            refusedChecksPerPlayerPerDay: e.GENERATION_REFUSED_CHECKS_PER_PLAYER_PER_DAY,
            refusedChecksPerIpPerDay: e.GENERATION_REFUSED_CHECKS_PER_IP_PER_DAY,
            dailyBudgetUsd: e.GENERATION_DAILY_BUDGET_USD,
          }
        : null,
    openRouter: {
      apiKey: e.OPENROUTER_API_KEY.trim() || null,
      deckModel: e.DECK_MODEL,
      fallbackModels: splitList(e.DECK_FALLBACK_MODELS),
      requireParameters: e.DECK_REQUIRE_PARAMETERS === 'on',
      themeCheckModel: e.THEME_CHECK_MODEL,
      themeCheckFallbackModels: e.THEME_CHECK_FALLBACK_MODELS.trim()
        ? splitList(e.THEME_CHECK_FALLBACK_MODELS)
        : [e.DECK_MODEL, ...splitList(e.DECK_FALLBACK_MODELS)].filter(
            (m) => m !== e.THEME_CHECK_MODEL,
          ),
    },
  };
}
