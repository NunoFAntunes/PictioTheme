import type { Card } from '@pictiotheme/protocol';
import type { MatchResults } from '@pictiotheme/protocol/tower';
import { and, asc, eq, inArray, ne, sql } from 'drizzle-orm';
import type { Db, DbExecutor } from '../../db/client';
import { cards, decks, towerDecks, towerMatches, towerMatchPlayers } from '../../db/schema';

/**
 * Doodle Tower's tables. Reads the decks module's `decks` and `cards` (read-only joins are allowed,
 * rule B5): Doodle Tower deals their easy cards, it never changes them.
 */

/** The easy cards of every enabled tower deck: Tower Mix (docs/tower/product/word-pool.md). */
export async function towerMixWords(db: DbExecutor): Promise<Card[]> {
  const rows = await db
    .select({
      text: cards.text,
      kind: cards.kind,
      alternates: cards.alternates,
      keywords: cards.keywords,
    })
    .from(cards)
    .innerJoin(towerDecks, eq(towerDecks.deckId, cards.deckId))
    .innerJoin(decks, eq(decks.id, cards.deckId))
    .where(
      and(eq(towerDecks.enabled, true), eq(cards.kind, 'easy'), ne(decks.visibility, 'hidden')),
    )
    .orderBy(asc(towerDecks.sort), asc(cards.text));
  // The same word in two decks is dealt once.
  const seen = new Set<string>();
  return rows.flatMap((r) => {
    const key = r.text.toLowerCase();
    if (seen.has(key) || r.keywords.length === 0) return [];
    seen.add(key);
    return [
      { text: r.text, kind: 'easy' as const, alternates: r.alternates, keywords: r.keywords },
    ];
  });
}

/** Adds these decks (by slug, in order) to the allowlist. Existing rows are left as they are. */
export async function addTowerDecks(db: DbExecutor, slugs: readonly string[]): Promise<number> {
  if (slugs.length === 0) return 0;
  const found = await db
    .select({ id: decks.id, slug: decks.slug })
    .from(decks)
    .where(inArray(decks.slug, [...slugs]));
  if (found.length === 0) return 0;
  const inserted = await db
    .insert(towerDecks)
    .values(found.map((d) => ({ deckId: d.id, sort: slugs.indexOf(d.slug) })))
    .onConflictDoNothing()
    .returning({ deckId: towerDecks.deckId });
  return inserted.length;
}

export async function insertMatch(
  db: Db,
  match: {
    roomCode: string;
    settings: Record<string, unknown>;
    results: MatchResults;
    startedAt: Date;
    endedAt: Date;
  },
): Promise<void> {
  await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(towerMatches)
      .values({
        roomCode: match.roomCode,
        settings: match.settings,
        winner: match.results.winner,
        endReason: match.results.reason,
        heightOrange: match.results.heights.orange,
        heightTeal: match.results.heights.teal,
        startedAt: match.startedAt,
        endedAt: match.endedAt,
      })
      .returning({ id: towerMatches.id });
    if (!row || match.results.players.length === 0) return;
    await tx.insert(towerMatchPlayers).values(
      match.results.players.map((p) => ({
        matchId: row.id,
        playerId: p.id,
        team: p.team,
        displayName: p.name,
        drawings: p.drawings,
        solves: p.solves,
        steals: p.steals,
        // The column predates curses: a cursed piece is still sent.
        sends: p.curses,
        placements: p.placements,
        fumbles: p.fumbles,
      })),
    );
  });
}

/** For tests: how many matches a room has recorded. */
export async function countMatches(db: DbExecutor, roomCode: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(towerMatches)
    .where(eq(towerMatches.roomCode, roomCode));
  return row?.n ?? 0;
}
