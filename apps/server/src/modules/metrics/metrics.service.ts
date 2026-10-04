import type { MetricEffect } from '@pictiotheme/game-core';
import type { ClientEvent } from '@pictiotheme/protocol';
import type { Db } from '../../db/client';
import { playerIdOf, type Actor } from '../../lib/actor';
import type { Logger } from '../../lib/logger';
import type { DecksService } from '../decks';
import * as repo from './metrics.repository';

/**
 * Launch metrics (next-features.md 1.11, "What to measure at launch"): product events in our own
 * `product_events` table, and card quality stats (offered, picked, drawn, guessed, 👍/👎) on the
 * cards. Everything here is best-effort: a failed write is logged and the game goes on.
 *
 * Events: `room_created`, `match_started`, `match_ended`, `turn_ended` (from the server), and
 * `first_turn`, `phone_gate`, `room_joined` (from the browser, `POST /api/events`). Generation
 * metrics come straight from `generation_jobs`. The report is `pnpm metrics:report`.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createMetricsService(deps: { db: Db; log: Logger; decks: DecksService }) {
  const log = deps.log.child({ module: 'metrics' });
  const inFlight = new Set<Promise<void>>();
  /** The last pending write per key, so writes that must stay in order (votes) are chained. */
  const chains = new Map<string, Promise<void>>();

  /**
   * Runs a write without blocking the caller; failures are logged, never thrown. Writes with the
   * same `key` run one after another, in call order (a 👎 then a 👍 must end as 👍). Counters
   * don't need a key: increments commute.
   */
  function later(what: string, write: () => Promise<void>, key?: string): void {
    const previous = key ? chains.get(key) : undefined;
    const done: Promise<void> = (previous ?? Promise.resolve())
      .then(write)
      .catch((err: unknown) => log.warn({ err, what }, 'metric write failed'))
      .finally(() => {
        inFlight.delete(done);
        if (key && chains.get(key) === done) chains.delete(key);
      });
    inFlight.add(done);
    if (key) chains.set(key, done);
  }

  function record(event: repo.NewEvent): void {
    const deckId = event.deckId && UUID.test(event.deckId) ? event.deckId : null;
    later(event.name, () => repo.insertEvent(deps.db, { ...event, deckId }));
  }

  return {
    record,

    /** A room's metric effect (game-core `MetricEffect`). */
    onRoomEffect(roomCode: string, effect: MetricEffect): void {
      switch (effect.kind) {
        case 'matchStarted':
          record({
            name: 'match_started',
            roomCode,
            deckId: effect.deckId,
            props: { players: effect.playerIds.length },
          });
          return;
        case 'matchEnded': {
          const { summary } = effect;
          record({
            name: 'match_ended',
            roomCode,
            deckId: summary.deckId,
            props: {
              reason: summary.reason,
              turns: summary.turns,
              durationMs: summary.endedAt - summary.startedAt,
              // Player ids, to join with `room_joined` devices (never names).
              players: summary.players.map((p) => p.id),
            },
          });
          return;
        }
        case 'cardsDealt': {
          const { deckId } = effect;
          if (deckId) later('cards_dealt', () => deps.decks.recordCardsDealt(deckId, effect));
          return;
        }
        case 'turnEnded': {
          const { deckId } = effect;
          record({
            name: 'turn_ended',
            roomCode,
            deckId,
            props: { reason: effect.reason, guessers: effect.guessers, solved: effect.solved },
          });
          if (deckId && effect.solved > 0) {
            later('card_guessed', () => deps.decks.recordCardGuessed(deckId, effect.card));
          }
          return;
        }
        case 'cardVoted': {
          const { deckId } = effect;
          if (deckId) {
            later(
              'card_voted',
              () => deps.decks.setCardVote(deckId, effect.card, effect.playerId, effect.vote),
              `vote|${deckId}|${effect.card}|${effect.playerId}`,
            );
          }
          return;
        }
      }
    },

    /** What the browser reports. Anonymous events (the phone gate) have no player. */
    onClientEvent(actor: Actor | null, event: ClientEvent): void {
      const { name, ...props } = event;
      record({ name, playerId: actor ? playerIdOf(actor) : null, props });
    },

    /** Resolves when pending writes finish. Used on shutdown and in tests. */
    async idle(): Promise<void> {
      await Promise.allSettled([...inFlight]);
    },
  };
}

export type MetricsService = ReturnType<typeof createMetricsService>;
