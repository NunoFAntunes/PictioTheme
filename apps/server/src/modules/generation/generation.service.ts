import type { Card, DeckGenerationRequest, GeneratedDeck } from '@pictiotheme/protocol';
import type { z } from 'zod';
import { AppError, serviceUnavailable } from '../../lib/errors';
import type { Logger } from '../../lib/logger';
import {
  buildDeck,
  cleanCards,
  hasBlockedMeta,
  missingCounts,
  type DropCounts,
} from './clean-deck';
import { assertAllowedRequest } from './content-check';
import { deckUserPrompt, SYSTEM_PROMPT, topUpUserPrompt } from './deck-prompt';
import {
  DECK_JSON_SCHEMA,
  LlmDeckOutput,
  LlmTopUpOutput,
  TOP_UP_JSON_SCHEMA,
} from './generation.schemas';
import {
  LlmTransportError,
  type LlmClient,
  type LlmJsonRequest,
  type LlmUsage,
} from './llm/llm-client';

/**
 * AI deck generation: prompt → model → cleanup → one top-up if short → validated deck.
 * Pipeline: docs/technical/ai-deck-pipeline.md.
 *
 * Not yet here (see the doc): the generation job queue, credits, saving the draft deck,
 * streaming progress, and the profanity blocklist.
 */

/**
 * Room for ~150 cards with alternates and keywords (~8-12k tokens) plus reasoning. At 16k,
 * reasoning models ran out before writing the JSON (model eval, 2026-10-03).
 */
export const DECK_MAX_TOKENS = 32_000;
export const TOP_UP_MAX_TOKENS = 12_000;

export type GenerationResult = {
  deck: GeneratedDeck;
  /** Summed over every model call made for this deck. */
  usage: LlmUsage;
  /** The models that served each call, in order (fallbacks may differ from config). */
  models: string[];
  /** The provider OpenRouter routed each call to, in the same order. */
  providers: (string | null)[];
  dropped: DropCounts;
  toppedUp: boolean;
};

/**
 * Why a reply couldn't be used. Only `invalid` is retried: asking again rarely changes a refusal,
 * and a reply cut off at the token limit is cut off again at the same limit.
 */
type BadReply = 'refused' | 'truncated' | 'invalid';

export const generationFailed = () =>
  new AppError('GENERATION_FAILED', 422, "We couldn't make a deck for that theme");

export function createGenerationService(deps: {
  llm: LlmClient | null;
  log: Logger;
  /** Overridden only by the model eval script, to compare prompt variants. */
  systemPrompt?: string;
}) {
  const log = deps.log.child({ module: 'generation' });
  const systemPrompt = deps.systemPrompt ?? SYSTEM_PROMPT;

  /** One model call, parsed with `schema`. Transport failures become AppErrors. */
  async function callModel<T>(llm: LlmClient, request: LlmJsonRequest, schema: z.ZodType<T>) {
    let completion;
    try {
      completion = await llm.completeJson(request);
    } catch (err) {
      if (err instanceof LlmTransportError && err.retryable) {
        log.warn({ err, status: err.status }, 'model call failed');
        throw serviceUnavailable('Deck generation is busy, try again in a minute');
      }
      throw err;
    }

    const { content, finishReason, refusal } = completion;
    let result: { ok: true; value: T } | { ok: false; reason: BadReply };
    if (refusal || finishReason === 'content_filter') {
      result = { ok: false, reason: 'refused' };
    } else if (finishReason === 'length') {
      result = { ok: false, reason: 'truncated' };
    } else {
      const parsed = schema.safeParse(parseJson(content));
      result = parsed.success ? { ok: true, value: parsed.data } : { ok: false, reason: 'invalid' };
    }
    return { completion, result };
  }

  return {
    async generateDeck(request: DeckGenerationRequest): Promise<GenerationResult> {
      const { llm } = deps;
      if (!llm) throw serviceUnavailable('AI deck generation is not configured');
      assertAllowedRequest(request);

      const usage: LlmUsage = { inputTokens: 0, outputTokens: 0, costUsd: null };
      const models: string[] = [];
      const providers: (string | null)[] = [];
      const track = (c: { model: string; provider: string | null; usage: LlmUsage }) => {
        models.push(c.model);
        providers.push(c.provider);
        usage.inputTokens += c.usage.inputTokens;
        usage.outputTokens += c.usage.outputTokens;
        if (c.usage.costUsd !== null) usage.costUsd = (usage.costUsd ?? 0) + c.usage.costUsd;
      };
      const fail = (reason: string): never => {
        log.warn({ reason, models, ...usage }, 'deck generation failed');
        throw generationFailed();
      };

      // 1. The deck. A malformed reply gets one retry.
      const deckRequest = {
        system: systemPrompt,
        user: deckUserPrompt(request),
        schema: DECK_JSON_SCHEMA,
        maxTokens: DECK_MAX_TOKENS,
      };
      let first = await callModel(llm, deckRequest, LlmDeckOutput);
      track(first.completion);
      if (!first.result.ok && first.result.reason === 'invalid') {
        first = await callModel(llm, deckRequest, LlmDeckOutput);
        track(first.completion);
      }
      if (!first.result.ok) return fail(first.result.reason);
      const output = first.result.value;
      // The prompt's signal for a theme that can't be made family friendly. A top-up won't help.
      if (output.cards.length === 0) return fail('refused: empty deck');
      if (hasBlockedMeta(output)) return fail('blocked title, description or tag');

      // 2. Cleanup.
      const cleaned = cleanCards(output.cards, request);
      const dropped = cleaned.dropped;
      let cards: Card[] = cleaned.cards;

      // 3. One top-up call for pools that came out short.
      let missing = missingCounts(request, cards);
      const toppedUp = missing.size > 0;
      if (toppedUp) {
        const topUp = await callModel(
          llm,
          {
            system: systemPrompt,
            user: topUpUserPrompt(
              request,
              missing,
              cards.map((c) => c.text),
            ),
            schema: TOP_UP_JSON_SCHEMA,
            maxTokens: TOP_UP_MAX_TOKENS,
          },
          LlmTopUpOutput,
        );
        track(topUp.completion);
        if (topUp.result.ok) {
          const extra = cleanCards(topUp.result.value.cards, request, cards);
          cards = [...cards, ...extra.cards];
          for (const [reason, n] of Object.entries(extra.dropped)) {
            dropped[reason as keyof DropCounts] += n;
          }
        }
        missing = missingCounts(request, cards);
        if (missing.size > 0) return fail(`too few cards: ${[...missing.keys()].join(', ')}`);
      }

      const deck = buildDeck(output, cards, request);
      log.info({ models, ...usage, cards: deck.cards.length, dropped, toppedUp }, 'deck generated');
      return { deck, usage, models, providers, dropped, toppedUp };
    },
  };
}

/** Models that don't enforce the JSON schema sometimes wrap the reply in a ```json fence. */
function parseJson(content: string | null): unknown {
  if (content === null) return null;
  const unfenced = content
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  try {
    return JSON.parse(unfenced);
  } catch {
    return null;
  }
}

export type GenerationService = ReturnType<typeof createGenerationService>;
