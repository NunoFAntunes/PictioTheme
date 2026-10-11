import { createHmac } from 'node:crypto';
import {
  CHAOS_MIN_CARDS,
  type AddChaosResponse,
  type DeckCoverImage,
  type DeckGenerationRequest,
  type DeckLanguage,
  type DeckSummary,
  type GenerationConfigResponse,
  type GenerationJob,
  type TranslateDeckResponse,
} from '@pictiotheme/protocol';
import type { GenerationLimits } from '../../config';
import type { Db } from '../../db/client';
import { playerIdOf, type Actor } from '../../lib/actor';
import { AppError, conflict, forbidden, notFound, serviceUnavailable } from '../../lib/errors';
import type { Logger } from '../../lib/logger';
import type { DecksService, TranslationSource } from '../decks';
import type { CallStats, GenerationService } from './generation.service';
import { assertAllowedRequest } from './content-check';
import * as repo from './generation.repository';

/**
 * Deck generation and translation as jobs a player starts and then polls
 * (docs/product/user-flows.md §8). Jobs run in this process: a restart fails the running ones
 * (`failInterrupted`). The pg-boss queue, credits and the review step replace parts of this later
 * (ai-deck-pipeline.md).
 *
 * The creator draws the deck's back cover while it generates, so the cover can arrive before or
 * after the deck. The job holds it, and whichever comes second copies it onto the deck: each
 * side writes its own column, then reads the other's, so one of them always sees both.
 *
 * Translations (decks.md#languages) are shared: the first host to pick a deck in a new language
 * starts one, anyone else asking meanwhile waits on the same job, and later rooms get the saved
 * translation straight away. A translation keeps the original's cover.
 *
 * Chaos cards for a deck without them (decks.md#chaos-cards) are shared the same way: any host
 * may start them, others wait on the same job, and rooms playing the deck reload it when they're
 * saved (`onDeckCardsAdded`).
 */

/** How many of a player's generated decks the deck picker shows. */
const MY_DECKS_LIMIT = 20;

const DAY_MS = 24 * 60 * 60 * 1000;
/**
 * What a running job is assumed to cost until it reports its real cost, for the daily budget.
 * A deck costs ~$0.004 (model-eval-2026-10.md); this leaves room for top-ups and the fallback.
 */
const RUNNING_JOB_ESTIMATE_USD = 0.02;

/** The job was failed by a restart while the model worked: nothing to save or record. */
class Interrupted extends Error {}

function hoursUntil(at: Date, now: number): number {
  return Math.max(1, Math.ceil((at.getTime() - now) / (60 * 60 * 1000)));
}

const MESSAGES = {
  failed: "We couldn't make a deck for that theme. Try a different theme.",
  chaosFailed: "We couldn't make Chaos cards for this deck. Try again, or pick another deck.",
  translationFailed:
    "This deck doesn't translate well into that language. Try another deck, or generate one in it.",
  busy: 'Deck generation is busy right now. Try again in a minute.',
  unexpected: 'Something went wrong while making the deck. Try again.',
  interrupted: 'The server restarted while making the deck. Try again.',
};

function failureMessage(err: unknown, kind: repo.JobKind): string {
  if (err instanceof AppError && err.code === 'GENERATION_FAILED') {
    if (kind === 'chaos') return MESSAGES.chaosFailed;
    return kind === 'translate' ? MESSAGES.translationFailed : MESSAGES.failed;
  }
  if (err instanceof AppError && err.code === 'SERVICE_UNAVAILABLE') return MESSAGES.busy;
  return MESSAGES.unexpected;
}

export function createGenerationJobsService(deps: {
  db: Db;
  log: Logger;
  generation: GenerationService;
  decks: DecksService;
  /** The `DECK_GENERATION` feature flag. Turns translations off too. */
  enabled: boolean;
  /** Null: no limits (tests, local development). */
  limits: GenerationLimits | null;
  /** Keys the IP hashes (the session secret). */
  secret: string;
  /** A deck got new cards (its Chaos cards): rooms playing it reload it. */
  onDeckCardsAdded?: (deckId: string) => void;
}) {
  const log = deps.log.child({ module: 'generation-jobs' });
  const inFlight = new Set<Promise<void>>();

  async function toDto(job: repo.JobRow): Promise<GenerationJob> {
    const [deck] = job.deckId ? await deps.decks.summaries([job.deckId]) : [];
    return {
      id: job.id,
      kind: job.kind as GenerationJob['kind'],
      status: job.status as GenerationJob['status'],
      theme: job.theme,
      language: job.language as DeckLanguage,
      error: job.error,
      deck: deck ?? null,
      createdAt: job.createdAt.toISOString(),
    };
  }

  /**
   * Runs a job to the end: `produce` makes and saves the deck and returns its id with what the
   * model calls cost. Never throws: a failure is recorded on the job for the player to see.
   */
  async function run(
    job: repo.JobRow,
    produce: () => Promise<{ deckId: string; result: CallStats }>,
  ): Promise<void> {
    const started = Date.now();
    const jobId = job.id;
    try {
      const { deckId, result } = await produce();
      await repo.finishJob(deps.db, jobId, {
        status: 'published',
        deckId,
        model: result.models.at(-1) ?? null,
        provider: result.providers.at(-1) ?? null,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        costUsd: result.usage.costUsd,
      });
      log.info({ jobId, kind: job.kind, deckId, ms: Date.now() - started }, 'job published');
    } catch (err) {
      if (err instanceof Interrupted) return;
      const expected = err instanceof AppError;
      log[expected ? 'warn' : 'error'](
        { err, jobId, kind: job.kind, ms: Date.now() - started },
        'job failed',
      );
      await repo
        .finishJob(deps.db, jobId, {
          status: 'failed',
          error: failureMessage(err, job.kind as repo.JobKind),
        })
        .catch((dbErr: unknown) => log.error({ err: dbErr, jobId }, 'could not record failed job'));
    }
  }

  function startInBackground(work: Promise<void>): void {
    const running = work.finally(() => inFlight.delete(running));
    inFlight.add(running);
  }

  /** A restart may have failed the job meanwhile (`failInterrupted`): don't save an orphan deck. */
  async function assertStillRunning(jobId: string): Promise<repo.JobRow> {
    const current = await repo.findJob(deps.db, jobId);
    if (current?.status !== 'running') throw new Interrupted();
    return current;
  }

  async function generate(job: repo.JobRow, request: DeckGenerationRequest) {
    const result = await deps.generation.generateDeck(request);
    const current = await assertStillRunning(job.id);
    const deckId = await deps.decks.saveGeneratedDeck(result.deck, {
      theme: request.theme,
      model: result.models.at(-1) ?? null,
      coverId: current.coverId,
      language: request.language,
    });
    return { deckId, result, coverBefore: current.coverId };
  }

  async function translate(job: repo.JobRow, source: TranslationSource, language: DeckLanguage) {
    const result = await deps.generation.translateDeck(source, language);
    await assertStillRunning(job.id);
    const deckId = await deps.decks.saveTranslatedDeck(source, result.deck, {
      language,
      model: result.models.at(-1) ?? null,
    });
    return { deckId, result };
  }

  async function addChaos(job: repo.JobRow, source: TranslationSource) {
    const result = await deps.generation.makeChaosCards({
      theme: source.title,
      description: source.description,
      notes: '',
      language: source.language,
      deckCards: source.cards.filter((c) => c.kind !== 'chaos').map((c) => c.text),
      chaosCards: source.cards.filter((c) => c.kind === 'chaos').map((c) => c.text),
    });
    await assertStillRunning(job.id);
    await deps.decks.addCards(source.id, result.cards);
    deps.onDeckCardsAdded?.(source.id);
    return { deckId: source.id, result };
  }

  /** Stores the cover and points the job, and its deck if it has one, at it. */
  async function saveCover(job: repo.JobRow, image: DeckCoverImage): Promise<repo.JobRow> {
    // Covers are shown to strangers: players report them (decks.service.ts `report`).
    const coverId = await deps.decks.storeCover(image);
    await repo.setJobCover(deps.db, job.id, coverId);
    const updated = (await repo.findJob(deps.db, job.id)) ?? job;
    if (updated.deckId) await deps.decks.setCover(updated.deckId, coverId);
    return updated;
  }

  const ipHashOf = (ip: string) =>
    createHmac('sha256', deps.secret).update(`generation-ip:${ip}`).digest('hex').slice(0, 32);

  /** This player's jobs of `kind` that count today, oldest first. */
  const countedToday = (kind: repo.JobKind, playerId: string, now: number) =>
    repo.countedJobsSince(deps.db, kind, { createdBy: playerId }, new Date(now - DAY_MS));

  /**
   * The daily limits (next-features.md 1.6): per player, per IP, and a global budget shared by
   * generations and translations. Checked before a job starts. Two requests racing can both
   * pass; the one-running-job rule and the budget's margin keep that small.
   */
  async function assertWithinLimits(
    kind: repo.JobKind,
    playerId: string,
    ipHash: string,
  ): Promise<void> {
    const { limits } = deps;
    if (!limits) return;
    const now = Date.now();
    const since = new Date(now - DAY_MS);
    const perKind = {
      generate: { player: limits.perPlayerPerDay, ip: limits.perIpPerDay, verb: 'made' },
      translate: {
        player: limits.translationsPerPlayerPerDay,
        ip: limits.translationsPerIpPerDay,
        verb: 'translated',
      },
      chaos: {
        player: limits.chaosPerPlayerPerDay,
        ip: limits.chaosPerIpPerDay,
        verb: 'given Chaos cards',
      },
    }[kind];

    const mine = await countedToday(kind, playerId, now);
    if (mine.length >= perKind.player) {
      const next = mine[mine.length - perKind.player];
      const wait = next
        ? ` You can make another in about ${hoursUntil(new Date(next.getTime() + DAY_MS), now)} h.`
        : '';
      const message = {
        generate: `You've used today's free deck.${wait}`,
        translate: `You've translated ${perKind.player} decks today.${wait} Decks someone already translated are still free to pick.`,
        chaos: `You've made Chaos cards for ${perKind.player} decks today.${wait} Decks that already have them are still free to play.`,
      }[kind];
      throw new AppError('RATE_LIMITED', 429, message);
    }
    const fromIp = await repo.countedJobsSince(deps.db, kind, { clientIpHash: ipHash }, since);
    if (fromIp.length >= perKind.ip) {
      throw new AppError(
        'RATE_LIMITED',
        429,
        `Lots of decks were ${perKind.verb} from your network today. Try again tomorrow.`,
      );
    }
    const spend = await repo.spendSince(deps.db, since);
    if (spend.costUsd + spend.running * RUNNING_JOB_ESTIMATE_USD >= limits.dailyBudgetUsd) {
      log.warn({ ...spend, budget: limits.dailyBudgetUsd }, 'daily generation budget reached');
      throw serviceUnavailable('Deck generation is busy right now. Try again later.');
    }
  }

  /**
   * Refused theme checks never become jobs, so they're capped on their own: otherwise a player
   * could send bad themes over and over, each one a model call (ai-deck-pipeline.md#theme-check).
   */
  async function assertChecksLeft(playerId: string, ipHash: string): Promise<void> {
    const { limits } = deps;
    if (!limits) return;
    const since = new Date(Date.now() - DAY_MS);
    const mine = await repo.refusedChecksSince(deps.db, { createdBy: playerId }, since);
    const fromIp = await repo.refusedChecksSince(deps.db, { clientIpHash: ipHash }, since);
    if (mine >= limits.refusedChecksPerPlayerPerDay || fromIp >= limits.refusedChecksPerIpPerDay) {
      throw new AppError(
        'RATE_LIMITED',
        429,
        "That's a lot of themes we couldn't use today. Try again tomorrow.",
      );
    }
  }

  async function insertJob(job: repo.NewJob): Promise<repo.JobRow> {
    try {
      return await repo.insertJob(deps.db, job);
    } catch (err) {
      if (repo.isOneRunningViolation(err)) throw conflict('You already have a deck being made');
      throw err;
    }
  }

  return {
    /** Whether generation is on, and how many decks this player has left today. */
    async config(actor: Actor | null): Promise<GenerationConfigResponse> {
      const { limits } = deps;
      if (!deps.enabled || !limits || !actor) return { enabled: deps.enabled, daily: null };
      const now = Date.now();
      const mine = await countedToday('generate', playerIdOf(actor), now);
      const remaining = Math.max(0, limits.perPlayerPerDay - mine.length);
      const next = remaining === 0 ? mine[mine.length - limits.perPlayerPerDay] : undefined;
      return {
        enabled: true,
        daily: {
          limit: limits.perPlayerPerDay,
          remaining,
          nextAt: next ? new Date(next.getTime() + DAY_MS).toISOString() : null,
        },
      };
    },

    /**
     * Starts a generation and returns right away. The player polls `getJob` for the result.
     * The theme is checked first (blocklist, then the model's theme check), so a theme in the
     * wrong language or too unclear for a deck never starts a job or uses up the daily deck. Each
     * check is recorded with its cost (the daily budget counts it), and refused ones are capped.
     */
    async startJob(
      actor: Actor,
      request: DeckGenerationRequest,
      clientIp: string,
    ): Promise<GenerationJob> {
      if (!deps.enabled) throw forbidden('Deck generation is turned off on this server');
      // Before the job exists, so a blocked theme never starts (ai-deck-pipeline.md#theme-pre-check).
      assertAllowedRequest(request);
      const playerId = playerIdOf(actor);
      const clientIpHash = ipHashOf(clientIp);
      await assertWithinLimits('generate', playerId, clientIpHash);
      await assertChecksLeft(playerId, clientIpHash);
      const check = await deps.generation.checkTheme(request);
      await repo.insertThemeCheck(deps.db, {
        createdBy: playerId,
        clientIpHash,
        theme: request.theme,
        language: request.language,
        verdict: check.verdict,
        model: check.model,
        costUsd: check.costUsd,
      });
      if (check.error) throw check.error;
      const job = await insertJob({
        kind: 'generate',
        createdBy: playerId,
        clientIpHash,
        theme: request.theme,
        notes: request.notes,
        includeChaos: request.chaos,
        language: request.language,
      });
      startInBackground(
        run(job, async () => {
          const { deckId, result, coverBefore } = await generate(job, request);
          // A cover drawn while the deck was being saved.
          const coverId = (await repo.findJob(deps.db, job.id))?.coverId;
          if (coverId && coverId !== coverBefore) await deps.decks.setCover(deckId, coverId);
          return { deckId, result };
        }),
      );
      return toDto(job);
    },

    /**
     * A deck in another language (`POST /api/decks/:id/translations`): the existing translation
     * if there is one, or the running translation to wait on, or a new one. New ones count
     * towards the player's daily translations.
     */
    async translate(
      actor: Actor,
      deckId: string,
      language: DeckLanguage,
      clientIp: string,
    ): Promise<TranslateDeckResponse> {
      const ready = await deps.decks.findInLanguage(deckId, language);
      if (ready) return { status: 'ready', deck: ready };
      if (!deps.enabled) throw forbidden('Deck translation is turned off on this server');
      const source = await deps.decks.translationSource(deckId);
      if (!source) throw notFound('Deck');
      // One exists but was hidden by reports: don't make it again behind the moderators' back.
      if (await deps.decks.hasTranslation(source.id, language)) throw notFound('Translation');
      const running = await repo.findRunningTranslation(deps.db, source.id, language);
      if (running) return { status: 'translating', job: await toDto(running) };

      const playerId = playerIdOf(actor);
      const clientIpHash = ipHashOf(clientIp);
      await assertWithinLimits('translate', playerId, clientIpHash);
      let job: repo.JobRow;
      try {
        job = await insertJob({
          kind: 'translate',
          createdBy: playerId,
          clientIpHash,
          theme: source.title,
          includeChaos: false,
          language,
          sourceDeckId: source.id,
        });
      } catch (err) {
        // Another host started it a moment ago: wait on theirs.
        if (!repo.isOneTranslationViolation(err)) throw err;
        const theirs = await repo.findRunningTranslation(deps.db, source.id, language);
        if (!theirs) throw err;
        return { status: 'translating', job: await toDto(theirs) };
      }
      startInBackground(run(job, () => translate(job, source, language)));
      return { status: 'translating', job: await toDto(job) };
    },

    /**
     * Chaos cards for a deck that has too few (`POST /api/decks/:id/chaos`): the deck if it
     * already has them, or the running job to wait on, or a new one. Any host may ask; new ones
     * count towards the player's daily Chaos limit.
     */
    async addChaos(actor: Actor, deckId: string, clientIp: string): Promise<AddChaosResponse> {
      const source = await deps.decks.chaosSource(deckId);
      if (!source) throw notFound('Deck');
      const chaosCards = source.cards.filter((c) => c.kind === 'chaos').length;
      if (chaosCards >= CHAOS_MIN_CARDS) {
        const [deck] = await deps.decks.summaries([source.id]);
        if (!deck) throw notFound('Deck');
        // A room asking may have loaded the deck before they were added: let it load them.
        deps.onDeckCardsAdded?.(source.id);
        return { status: 'ready', deck };
      }
      if (!deps.enabled) throw forbidden('Deck generation is turned off on this server');
      const running = await repo.findRunningChaos(deps.db, source.id);
      if (running) return { status: 'generating', job: await toDto(running) };

      const playerId = playerIdOf(actor);
      const clientIpHash = ipHashOf(clientIp);
      await assertWithinLimits('chaos', playerId, clientIpHash);
      let job: repo.JobRow;
      try {
        job = await insertJob({
          kind: 'chaos',
          createdBy: playerId,
          clientIpHash,
          theme: source.title,
          includeChaos: true,
          language: source.language,
          sourceDeckId: source.id,
        });
      } catch (err) {
        // Another host started it a moment ago: wait on theirs.
        if (!repo.isOneChaosViolation(err)) throw err;
        const theirs = await repo.findRunningChaos(deps.db, source.id);
        if (!theirs) throw err;
        return { status: 'generating', job: await toDto(theirs) };
      }
      startInBackground(run(job, () => addChaos(job, source)));
      return { status: 'generating', job: await toDto(job) };
    },

    /**
     * A job. Generations only for the player who started them; translations and Chaos cards for
     * anyone, since several hosts can wait on the same one (and they show only the deck's title).
     */
    async getJob(actor: Actor, jobId: string): Promise<GenerationJob> {
      const job = await repo.findJob(deps.db, jobId);
      if (!job || (job.kind === 'generate' && job.createdBy !== playerIdOf(actor))) {
        throw notFound('Generation');
      }
      return toDto(job);
    },

    /**
     * Sets the back cover the creator drew, while the deck generates or after it's published.
     * Drawing it again replaces it. Translations keep their original's cover.
     */
    async setCover(actor: Actor, jobId: string, image: DeckCoverImage): Promise<GenerationJob> {
      const job = await repo.findJob(deps.db, jobId);
      if (!job || job.kind !== 'generate' || job.createdBy !== playerIdOf(actor)) {
        throw notFound('Generation');
      }
      if (job.status === 'failed') throw conflict('This deck failed to generate. Try again first');
      const updated = await saveCover(job, image);
      return toDto(updated);
    },

    /**
     * Redraws the back cover of a deck this player generated (`PUT /api/decks/:id/cover`).
     * Other players' decks and built-in decks are "not found", so ids don't leak ownership.
     * Rooms already playing the deck keep the cover they loaded until the deck is loaded again.
     */
    async setDeckCover(actor: Actor, deckId: string, image: DeckCoverImage): Promise<DeckSummary> {
      const job = await repo.findOwnJobForDeck(deps.db, deckId, playerIdOf(actor));
      if (!job) throw notFound('Deck');
      await saveCover(job, image);
      const [deck] = await deps.decks.summaries([deckId]);
      if (!deck) throw notFound('Deck');
      return deck;
    },

    /** The decks this player generated, newest first, each in `language` when translated into it. */
    async myDecks(actor: Actor, language?: DeckLanguage) {
      const ids = await repo.publishedDeckIds(deps.db, playerIdOf(actor), MY_DECKS_LIMIT);
      return deps.decks.summariesIn(ids, language);
    },

    /**
     * At boot: jobs left running by a previous process will never finish. Never throws, so the
     * server still starts (and `/api/ready` reports) when the database is down.
     */
    async failInterrupted(): Promise<void> {
      try {
        const count = await repo.failRunningJobs(deps.db, MESSAGES.interrupted);
        if (count > 0) log.warn({ count }, 'failed generation jobs interrupted by a restart');
      } catch (err) {
        log.error({ err }, 'could not fail interrupted generation jobs');
      }
    },

    /** Resolves when running jobs finish, or after `timeoutMs`. Used on shutdown and in tests. */
    async idle(timeoutMs: number): Promise<void> {
      let timer: NodeJS.Timeout | undefined;
      await Promise.race([
        Promise.allSettled([...inFlight]),
        new Promise((resolve) => (timer = setTimeout(resolve, timeoutMs))),
      ]);
      clearTimeout(timer);
    },
  };
}

export type GenerationJobsService = ReturnType<typeof createGenerationJobsService>;
