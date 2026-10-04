import { randomBytes } from 'node:crypto';
import type { DeckInfo } from '@pictiotheme/game-core';
import {
  DECK_COVER_HEIGHT_PX,
  DECK_COVER_MAX_BYTES,
  DECK_COVER_WIDTH_PX,
  type DeckCoverId,
  type DeckCoverImage,
  type DeckReportReason,
  type DeckSummary,
  type GeneratedDeck,
} from '@pictiotheme/protocol';
import type { Db } from '../../db/client';
import { AppError, notFound } from '../../lib/errors';
import { contentIdOf, decodePngDataUrl } from '../../lib/png';
import * as repo from './decks.repository';

/**
 * Decks available for play, all in the database: curated decks (seeded from `curated/`, see
 * curated-decks.ts) and AI-generated ones. The searchable library builds on the same tables.
 */

/**
 * Unique reports that hide a deck's cover (it falls back to the default) or the whole deck, until
 * a moderator reviews them (security-and-moderation.md#moderation-tooling-minimum).
 */
export const REPORTS_TO_HIDE = 3;

/** Search results per query. Enough for a picker; the library page will page through more. */
const SEARCH_LIMIT = 30;

/** Deck ids are uuids; anything else is garbage (or an old built-in id), never a DB lookup. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** "Pirate Party!" → "pirate-party-k3x9q2": readable, and unique without a lookup. */
function slugFor(title: string): string {
  const base = title
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return `${base || 'deck'}-${randomBytes(4).toString('hex')}`;
}

export function createDecksService(deps: { db: Db }) {
  /** Summaries of saved decks, in the order of `ids`. Unknown and hidden ids are skipped. */
  async function summaries(ids: string[]): Promise<DeckSummary[]> {
    const found = await repo.deckSummaries(
      deps.db,
      ids.filter((id) => UUID.test(id)),
    );
    const byId = new Map(found.map((d) => [d.id, d]));
    return ids.flatMap((id) => byId.get(id) ?? []);
  }

  return {
    /** The deck a new room starts with when none is picked: the first featured curated deck. */
    async defaultDeckId(): Promise<string | null> {
      return (await repo.curatedDeckIds(deps.db))[0] ?? null;
    },

    async exists(deckId: string): Promise<boolean> {
      return UUID.test(deckId) && repo.deckExists(deps.db, deckId);
    },

    /** The curated decks, featured first; or, with a query, the decks that match it. */
    async listDecks(q?: string): Promise<DeckSummary[]> {
      const query = q?.trim() ?? '';
      if (query === '') return summaries(await repo.curatedDeckIds(deps.db));
      return summaries(await repo.searchDeckIds(deps.db, query, SEARCH_LIMIT));
    },

    summaries,

    /** The cards a room plays with. */
    async getPlayableDeck(deckId: string): Promise<DeckInfo> {
      const deck = UUID.test(deckId) ? await repo.findDeckWithCards(deps.db, deckId) : null;
      if (!deck) throw notFound('Deck');
      return { id: deck.id, title: deck.title, coverId: deck.coverId, cards: deck.cards };
    },

    /** Saves an AI-generated deck. Returns its id. */
    async saveGeneratedDeck(
      deck: GeneratedDeck,
      meta: { theme: string; model: string | null; coverId: DeckCoverId | null },
    ): Promise<string> {
      return deps.db.transaction((tx) =>
        repo.insertDeck(
          tx,
          {
            slug: slugFor(deck.title),
            title: deck.title,
            description: deck.description,
            themeQuery: meta.theme,
            tags: deck.tags,
            source: 'ai',
            model: meta.model,
            coverId: meta.coverId,
          },
          deck.cards,
        ),
      );
    },

    /** Validates and stores a drawn back cover, returning its id. Idempotent. */
    async storeCover(image: DeckCoverImage): Promise<DeckCoverId> {
      const png = decodePngDataUrl(image, {
        width: DECK_COVER_WIDTH_PX,
        height: DECK_COVER_HEIGHT_PX,
        maxBytes: DECK_COVER_MAX_BYTES,
      });
      if (!png) {
        throw new AppError(
          'VALIDATION',
          400,
          `Deck covers must be ${DECK_COVER_WIDTH_PX}×${DECK_COVER_HEIGHT_PX} PNG images`,
        );
      }
      const id = contentIdOf(png);
      await repo.insertCover(deps.db, id, png);
      return id;
    },

    /** Points a saved deck at a stored cover. Who may do this is checked by the caller. */
    async setCover(deckId: string, coverId: DeckCoverId): Promise<void> {
      await repo.setDeckCover(deps.db, deckId, coverId);
    },

    /**
     * A player reports a saved deck's cover or content. Reporting the same thing twice counts
     * once. A cover report is about the cover shown right now, so a redrawn cover starts over.
     */
    async report(reporterId: string, deckId: string, reason: DeckReportReason): Promise<void> {
      if (!UUID.test(deckId)) throw notFound('Deck');
      await deps.db.transaction(async (tx) => {
        const deck = await repo.findReportableDeck(tx, deckId);
        if (!deck) throw notFound('Deck');
        if (reason === 'cover' && !deck.coverId) {
          throw new AppError('VALIDATION', 400, 'This deck has no drawn cover to report');
        }
        const coverId = reason === 'cover' ? deck.coverId : null;
        const added = await repo.insertReport(tx, { deckId, reporterId, reason, coverId });
        // Curated decks are never hidden automatically, so they can't be griefed away: their
        // reports wait for a moderator.
        if (!added || deck.source === 'curated') return;
        if ((await repo.countOpenReports(tx, deckId, reason, coverId)) < REPORTS_TO_HIDE) return;
        if (coverId) await repo.hideCover(tx, deckId, coverId);
        else await repo.hideDeck(tx, deckId);
      });
    },

    // ── Card stats and votes: best-effort, from the room shell (metrics module) ──

    async recordCardsDealt(
      deckId: string,
      dealt: { offered: string[]; drawn: string | null; pickedByDrawer: boolean },
    ): Promise<void> {
      if (UUID.test(deckId)) await repo.recordCardsDealt(deps.db, deckId, dealt);
    },

    async recordCardGuessed(deckId: string, text: string): Promise<void> {
      if (UUID.test(deckId)) await repo.recordCardGuessed(deps.db, deckId, text);
    },

    async setCardVote(
      deckId: string,
      text: string,
      playerId: string,
      vote: 'up' | 'down' | null,
    ): Promise<void> {
      if (!UUID.test(deckId)) return;
      await repo.setCardVote(
        deps.db,
        deckId,
        text,
        playerId,
        vote === null ? null : vote === 'up' ? 1 : -1,
      );
    },

    cardQuality: () => repo.cardQuality(deps.db),

    async getCoverPng(id: DeckCoverId): Promise<Buffer | null> {
      return repo.findCoverPng(deps.db, id);
    },
  };
}

export type DecksService = ReturnType<typeof createDecksService>;
