import { createHmac } from 'node:crypto';
import type {
  DeckCoverImage,
  DeckGenerationRequest,
  DeckSummary,
  GenerationConfigResponse,
  GenerationJob,
} from '@pictiotheme/protocol';
import type { GenerationLimits } from '../../config';
import type { Db } from '../../db/client';
import { playerIdOf, type Actor } from '../../lib/actor';
import { AppError, conflict, forbidden, notFound, serviceUnavailable } from '../../lib/errors';
import type { Logger } from '../../lib/logger';
import type { DecksService } from '../decks';
import type { GenerationService } from './generation.service';
import { assertAllowedRequest } from './content-check';
import * as repo from './generation.repository';

/**
 * Deck generation as jobs a player starts and then polls (docs/product/user-flows.md §8).
 * Jobs run in this process: a restart fails the running ones (`failInterrupted`). The pg-boss
 * queue, credits and the review step replace parts of this later (ai-deck-pipeline.md).
 *
 * The creator draws the deck's back cover while it generates, so the cover can arrive before or
 * after the deck. The job holds it, and whichever comes second copies it onto the deck: each
 * side writes its own column, then reads the other's, so one of them always sees both.
 */

/** How many of a player's generated decks the deck picker shows. */
const MY_DECKS_LIMIT = 20;

const DAY_MS = 24 * 60 * 60 * 1000;
/**
 * What a running job is assumed to cost until it reports its real cost, for the daily budget.
 * A deck costs ~$0.004 (model-eval-2026-10.md); this leaves room for top-ups and the fallback.
 */
const RUNNING_JOB_ESTIMATE_USD = 0.02;

function hoursUntil(at: Date, now: number): number {
  return Math.max(1, Math.ceil((at.getTime() - now) / (60 * 60 * 1000)));
}

const MESSAGES = {
  failed: "We couldn't make a deck for that theme. Try a different theme.",
  busy: 'Deck generation is busy right now. Try again in a minute.',
  unexpected: 'Something went wrong while making the deck. Try again.',
  interrupted: 'The server restarted while making the deck. Try again.',
};

function failureMessage(err: unknown): string {
  if (err instanceof AppError && err.code === 'GENERATION_FAILED') return MESSAGES.failed;
  if (err instanceof AppError && err.code === 'SERVICE_UNAVAILABLE') return MESSAGES.busy;
  return MESSAGES.unexpected;
}

export function createGenerationJobsService(deps: {
  db: Db;
  log: Logger;
  generation: GenerationService;
  decks: DecksService;
  /** The `DECK_GENERATION` feature flag. */
  enabled: boolean;
  /** Null: no limits (tests, local development). */
  limits: GenerationLimits | null;
  /** Keys the IP hashes (the session secret). */
  secret: string;
}) {
  const log = deps.log.child({ module: 'generation-jobs' });
  const inFlight = new Set<Promise<void>>();

  async function toDto(job: repo.JobRow): Promise<GenerationJob> {
    const [deck] = job.deckId ? await deps.decks.summaries([job.deckId]) : [];
    return {
      id: job.id,
      status: job.status as GenerationJob['status'],
      theme: job.theme,
      error: job.error,
      deck: deck ?? null,
      createdAt: job.createdAt.toISOString(),
    };
  }

  async function run(jobId: string, request: DeckGenerationRequest): Promise<void> {
    const started = Date.now();
    try {
      const result = await deps.generation.generateDeck(request);
      // A restart may have failed this job meanwhile (`failInterrupted`): don't save an orphan deck.
      const current = await repo.findJob(deps.db, jobId);
      if (current?.status !== 'running') return;
      const model = result.models.at(-1) ?? null;
      const deckId = await deps.decks.saveGeneratedDeck(result.deck, {
        theme: request.theme,
        model,
        coverId: current.coverId,
      });
      await repo.finishJob(deps.db, jobId, {
        status: 'published',
        deckId,
        model,
        provider: result.providers.at(-1) ?? null,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        costUsd: result.usage.costUsd,
      });
      // A cover drawn while the deck was being saved.
      const coverId = (await repo.findJob(deps.db, jobId))?.coverId;
      if (coverId && coverId !== current.coverId) await deps.decks.setCover(deckId, coverId);
      log.info({ jobId, deckId, ms: Date.now() - started }, 'generation job published');
    } catch (err) {
      const expected = err instanceof AppError;
      log[expected ? 'warn' : 'error'](
        { err, jobId, ms: Date.now() - started },
        'generation job failed',
      );
      await repo
        .finishJob(deps.db, jobId, { status: 'failed', error: failureMessage(err) })
        .catch((dbErr: unknown) => log.error({ err: dbErr, jobId }, 'could not record failed job'));
    }
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

  /** This player's jobs that count today, oldest first. */
  const countedToday = (playerId: string, now: number) =>
    repo.countedJobsSince(deps.db, { createdBy: playerId }, new Date(now - DAY_MS));

  /**
   * The daily limits (next-features.md 1.6): per player, per IP, and a global budget. Checked
   * before a job starts. Two requests racing can both pass; the one-running-job rule and the
   * budget's margin keep that small.
   */
  async function assertWithinLimits(playerId: string, ipHash: string): Promise<void> {
    const { limits } = deps;
    if (!limits) return;
    const now = Date.now();
    const since = new Date(now - DAY_MS);

    const mine = await countedToday(playerId, now);
    if (mine.length >= limits.perPlayerPerDay) {
      const next = mine[mine.length - limits.perPlayerPerDay];
      const wait = next
        ? ` You can make another in about ${hoursUntil(new Date(next.getTime() + DAY_MS), now)} h.`
        : '';
      throw new AppError('RATE_LIMITED', 429, `You've used today's free deck.${wait}`);
    }
    const fromIp = await repo.countedJobsSince(deps.db, { clientIpHash: ipHash }, since);
    if (fromIp.length >= limits.perIpPerDay) {
      throw new AppError(
        'RATE_LIMITED',
        429,
        'Lots of decks were made from your network today. Try again tomorrow.',
      );
    }
    const spend = await repo.spendSince(deps.db, since);
    if (spend.costUsd + spend.running * RUNNING_JOB_ESTIMATE_USD >= limits.dailyBudgetUsd) {
      log.warn({ ...spend, budget: limits.dailyBudgetUsd }, 'daily generation budget reached');
      throw serviceUnavailable('Deck generation is busy right now. Try again later.');
    }
  }

  return {
    /** Whether generation is on, and how many decks this player has left today. */
    async config(actor: Actor | null): Promise<GenerationConfigResponse> {
      const { limits } = deps;
      if (!deps.enabled || !limits || !actor) return { enabled: deps.enabled, daily: null };
      const now = Date.now();
      const mine = await countedToday(playerIdOf(actor), now);
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

    /** Starts a generation and returns right away. The player polls `getJob` for the result. */
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
      await assertWithinLimits(playerId, clientIpHash);
      let job: repo.JobRow;
      try {
        job = await repo.insertJob(deps.db, {
          createdBy: playerId,
          clientIpHash,
          theme: request.theme,
          notes: request.notes,
          difficulties: request.difficulties,
          includeSilly: request.silly,
        });
      } catch (err) {
        if (repo.isOneRunningViolation(err)) throw conflict('You already have a deck being made');
        throw err;
      }
      const running = run(job.id, request).finally(() => inFlight.delete(running));
      inFlight.add(running);
      return toDto(job);
    },

    /** A job, for the player who started it only. */
    async getJob(actor: Actor, jobId: string): Promise<GenerationJob> {
      const job = await repo.findJob(deps.db, jobId);
      if (!job || job.createdBy !== playerIdOf(actor)) throw notFound('Generation');
      return toDto(job);
    },

    /**
     * Sets the back cover the creator drew, while the deck generates or after it's published.
     * Drawing it again replaces it.
     */
    async setCover(actor: Actor, jobId: string, image: DeckCoverImage): Promise<GenerationJob> {
      const job = await repo.findJob(deps.db, jobId);
      if (!job || job.createdBy !== playerIdOf(actor)) throw notFound('Generation');
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

    /** The decks this player generated, newest first. */
    async myDecks(actor: Actor) {
      const ids = await repo.publishedDeckIds(deps.db, playerIdOf(actor), MY_DECKS_LIMIT);
      return deps.decks.summaries(ids);
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
