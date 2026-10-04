import type { Logger } from '../lib/logger';
import type { LlmCompletion, LlmJsonRequest } from '../modules/generation/llm/llm-client';

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

/**
 * The fake `LlmClient` (rule B9): replies with the queued results in order and records
 * each request. A queued Error is thrown instead. CI never calls OpenRouter.
 */
export function fakeLlm(replies: Array<LlmCompletion | Error>) {
  const requests: LlmJsonRequest[] = [];
  return {
    requests,
    async completeJson(request: LlmJsonRequest): Promise<LlmCompletion> {
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
