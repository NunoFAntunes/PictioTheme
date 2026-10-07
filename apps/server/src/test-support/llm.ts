import type { Logger } from '../lib/logger';
import type {
  LlmClient,
  LlmCompletion,
  LlmJsonRequest,
} from '../modules/generation/llm/llm-client';

/** A logger that drops everything. */
export function silentLogger(): Logger {
  const noop = () => {};
  const log: Logger = { debug: noop, info: noop, warn: noop, error: noop, child: () => log };
  return log;
}

/** A successful completion whose content is `output` as JSON. */
export function completion(output: unknown, overrides: Partial<LlmCompletion> = {}): LlmCompletion {
  return {
    content: JSON.stringify(output),
    finishReason: 'stop',
    refusal: null,
    model: 'test/model',
    provider: 'Test',
    usage: { inputTokens: 100, outputTokens: 1000, costUsd: 0.01 },
    ...overrides,
  };
}

/** A theme check that lets the theme through (theme-check.ts). */
export const ACCEPTED_THEME = {
  writtenIn: 'English',
  matchesLanguage: true,
  quality: 4,
  reason: 'A clear theme.',
};

/**
 * Wraps a model client so theme checks get `themeCheck` (accepted by default) and every other
 * call goes to `llm`. For tests about something else than the check.
 */
export function acceptingThemes(
  llm: LlmClient,
  themeCheck: LlmCompletion | Error = completion(ACCEPTED_THEME),
): LlmClient {
  return {
    async completeJson(request) {
      if (request.schema.name !== 'theme_check') return llm.completeJson(request);
      if (themeCheck instanceof Error) throw themeCheck;
      return themeCheck;
    },
  };
}

/**
 * The fake `LlmClient` (rule B9): replies with the queued results in order and records
 * each request. A queued Error is thrown instead. CI never calls OpenRouter.
 *
 * Theme checks (the quick call before a generation job) are answered apart from the queue, with
 * `themeCheck` (accepted by default), and recorded in `themeChecks` instead of `requests`.
 */
export function fakeLlm(
  replies: Array<LlmCompletion | Error>,
  options: { themeCheck?: LlmCompletion | Error } = {},
) {
  const requests: LlmJsonRequest[] = [];
  const themeChecks: LlmJsonRequest[] = [];
  return {
    requests,
    themeChecks,
    async completeJson(request: LlmJsonRequest): Promise<LlmCompletion> {
      if (request.schema.name === 'theme_check') {
        themeChecks.push(request);
        const reply = options.themeCheck ?? completion(ACCEPTED_THEME);
        if (reply instanceof Error) throw reply;
        return reply;
      }
      requests.push(request);
      const reply = replies.shift();
      if (!reply) throw new Error('fakeLlm: no reply queued');
      if (reply instanceof Error) throw reply;
      return reply;
    },
  };
}

type Pool = 'easy' | 'medium' | 'hard';

/**
 * A model reply with enough unique, letters-only cards for every requested pool:
 * "easy card ba", "easy card bb", … Silly cards use the first difficulty.
 */
export function fullDeckOutput(
  difficulties: Pool[],
  silly: boolean,
  title = 'Test Deck',
): Record<string, unknown> {
  const make = (prefix: string, difficulty: Pool, count: number, isSilly: boolean) =>
    Array.from({ length: count }, (_, n) => ({
      text: `${prefix} card ${String.fromCharCode(98 + Math.floor(n / 26), 97 + (n % 26))}`,
      difficulty,
      silly: isSilly,
      alternates: [],
      keywords: [],
    }));
  const counts = { easy: 40, medium: 40, hard: 30 };
  const first = difficulties[0] ?? 'easy';
  return {
    title,
    description: 'A deck for tests.',
    tags: ['test'],
    cards: [
      ...difficulties.flatMap((d) => make(d, d, counts[d], false)),
      ...(silly ? make('silly', first, 40, true) : []),
    ],
  };
}
