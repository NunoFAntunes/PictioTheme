import {
  Difficulty,
  type Card,
  type DeckGenerationRequest,
  type DeckLanguage,
  type GeneratedDeck,
} from '@pictiotheme/protocol';
import type { z } from 'zod';
import { AppError, serviceUnavailable } from '../../lib/errors';
import type { Logger } from '../../lib/logger';
import {
  buildDeck,
  cleanCards,
  emptyDropCounts,
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
  THEME_CHECK_JSON_SCHEMA,
  TOP_UP_JSON_SCHEMA,
  TRANSLATION_JSON_SCHEMA,
  type LlmCard,
} from './generation.schemas';
import {
  judgeTheme,
  LlmThemeCheck,
  THEME_CHECK_MAX_TOKENS,
  THEME_CHECK_PROMPT,
  themeCheckUserPrompt,
  type ThemeVerdict,
} from './theme-check';
import {
  LlmTranslationOutput,
  TRANSLATE_SYSTEM_PROMPT,
  translateUserPrompt,
  type TranslationInput,
} from './translate-prompt';
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

export const translationFailed = () =>
  new AppError('GENERATION_FAILED', 422, "This deck doesn't translate well into that language");

/**
 * A translation keeping fewer of the original's cards than this fails: the deck mostly doesn't
 * work in that language (wordplay, names nobody there knows).
 */
export const MIN_TRANSLATED_SHARE = 0.6;

/** Sums usage over a job's model calls, and remembers which models and providers served them. */
function usageTracker() {
  const usage: LlmUsage = { inputTokens: 0, outputTokens: 0, costUsd: null };
  const models: string[] = [];
  const providers: (string | null)[] = [];
  return {
    usage,
    models,
    providers,
    track: (c: { model: string; provider: string | null; usage: LlmUsage }) => {
      models.push(c.model);
      providers.push(c.provider);
      usage.inputTokens += c.usage.inputTokens;
      usage.outputTokens += c.usage.outputTokens;
      if (c.usage.costUsd !== null) usage.costUsd = (usage.costUsd ?? 0) + c.usage.costUsd;
    },
  };
}

/** How a theme check ended, and what it cost (recorded in `theme_checks`). */
export type ThemeCheckOutcome = {
  verdict: ThemeVerdict;
  /** What the player sees when the theme is refused; null when a job may start. */
  error: AppError | null;
  model: string;
  costUsd: number | null;
};

export function createGenerationService(deps: {
  llm: LlmClient | null;
  /** The cheaper model for the theme check. Defaults to `llm`. */
  themeCheckLlm?: LlmClient | null;
  /**
   * The theme check's reasoning effort: `low` for reasoning models, null for models that don't
   * reason. Overridden by the theme-check eval script.
   */
  themeCheckReasoning?: 'minimal' | 'low' | null;
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

      const { usage, models, providers, track } = usageTracker();
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

      const deck = buildDeck(output, cards, request.theme);
      log.info({ models, ...usage, cards: deck.cards.length, dropped, toppedUp }, 'deck generated');
      return { deck, usage, models, providers, dropped, toppedUp };
    },

    /**
     * The theme check (ai-deck-pipeline.md#theme-check): judges whether the theme is written in
     * the deck's language and clear enough for a good deck, with one quick call to the cheaper
     * theme-check model. Returns how it ended and what it cost; the caller records it and throws
     * `error` when there is one. An unreadable reply lets the theme through: generation has its
     * own guardrails, and a flaky check shouldn't block every deck. Transport failures throw.
     */
    async checkTheme(
      request: Pick<DeckGenerationRequest, 'theme' | 'notes' | 'language'>,
    ): Promise<ThemeCheckOutcome> {
      const llm = deps.themeCheckLlm === undefined ? deps.llm : deps.themeCheckLlm;
      if (!llm) throw serviceUnavailable('AI deck generation is not configured');
      const checkRequest = {
        system: THEME_CHECK_PROMPT,
        user: themeCheckUserPrompt(request),
        schema: THEME_CHECK_JSON_SCHEMA,
        maxTokens: THEME_CHECK_MAX_TOKENS,
        reasoningEffort: deps.themeCheckReasoning === undefined ? 'low' : deps.themeCheckReasoning,
      };
      let { completion, result } = await callModel(llm, checkRequest, LlmThemeCheck);
      // A malformed reply gets one retry: letting it through would skip the check.
      if (!result.ok && result.reason === 'invalid') {
        const first = completion.usage.costUsd;
        ({ completion, result } = await callModel(llm, checkRequest, LlmThemeCheck));
        if (first !== null) {
          completion.usage.costUsd = (completion.usage.costUsd ?? 0) + first;
        }
      }
      const { usage, model } = completion;
      const spent = { model, costUsd: usage.costUsd };
      if (!result.ok) {
        if (result.reason === 'refused') {
          log.warn({ model, ...usage }, 'theme check refused the theme');
          const error = new AppError(
            'VALIDATION',
            400,
            "We can't make a deck about that. Try a different theme.",
          );
          return { verdict: 'refused', error, ...spent };
        }
        log.warn({ reason: result.reason, model }, 'theme check unreadable, letting it through');
        return { verdict: 'unreadable', error: null, ...spent };
      }
      const check = result.value;
      const judged = judgeTheme(check, request.language);
      log.info(
        { ...check, verdict: judged.verdict, language: request.language, model, ...usage },
        'theme checked',
      );
      return { ...judged, ...spent };
    },

    /**
     * Translates a deck into `language` (ai-deck-pipeline.md#translation). The model translates,
     * keeps or localises names, and drops cards that don't work there; each card keeps the
     * original's difficulty and silliness, and goes through the same cleanup as a new deck.
     */
    async translateDeck(
      source: TranslationInput,
      language: DeckLanguage,
    ): Promise<GenerationResult> {
      const { llm } = deps;
      if (!llm) throw serviceUnavailable('AI deck generation is not configured');
      const { usage, models, providers, track } = usageTracker();
      const fail = (reason: string): never => {
        log.warn({ reason, models, ...usage, language }, 'deck translation failed');
        throw translationFailed();
      };

      const request = {
        system: TRANSLATE_SYSTEM_PROMPT,
        user: translateUserPrompt(source, language),
        schema: TRANSLATION_JSON_SCHEMA,
        maxTokens: DECK_MAX_TOKENS,
      };
      let reply = await callModel(llm, request, LlmTranslationOutput);
      track(reply.completion);
      if (!reply.result.ok && reply.result.reason === 'invalid') {
        reply = await callModel(llm, request, LlmTranslationOutput);
        track(reply.completion);
      }
      if (!reply.result.ok) return fail(reply.result.reason);
      const output = reply.result.value;
      if (hasBlockedMeta(output)) return fail('blocked title, description or tag');

      // Difficulty and silliness come from the original card, never from the model.
      const seen = new Set<number>();
      const translated: LlmCard[] = output.cards.flatMap((c) => {
        const original = source.cards[c.id];
        if (!original || seen.has(c.id)) return [];
        seen.add(c.id);
        return [{ ...c, difficulty: original.difficulty, silly: original.silly }];
      });
      const cleaned = cleanCards(translated, {
        difficulties: Difficulty.options,
        silly: true,
        language,
      });
      const kept = cleaned.cards.length / Math.max(1, source.cards.length);
      if (kept < MIN_TRANSLATED_SHARE) {
        return fail(`kept ${cleaned.cards.length} of ${source.cards.length} cards`);
      }

      const deck = buildDeck(output, cleaned.cards, source.title);
      const dropped: DropCounts = { ...emptyDropCounts(), ...cleaned.dropped };
      log.info(
        {
          models,
          ...usage,
          language,
          cards: deck.cards.length,
          of: source.cards.length,
          droppedByModel: output.dropped.length,
          dropped,
        },
        'deck translated',
      );
      return { deck, usage, models, providers, dropped, toppedUp: false };
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
