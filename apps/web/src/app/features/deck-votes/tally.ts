import type { DeckVotes, PlayerId, VotedDeck } from '@pictiotheme/protocol';

/** One deck players voted for, and who: the most voted first. */
export type DeckTally = { deck: VotedDeck; voters: PlayerId[] };

/**
 * The votes grouped by deck, most voted first; a tie keeps the order players are listed in, so
 * the deck voted for earliest-listed comes first and nothing jumps around while votes come in.
 */
export function tallyVotes(votes: DeckVotes, playerOrder: PlayerId[]): DeckTally[] {
  const byDeck = new Map<string, DeckTally>();
  for (const id of playerOrder) {
    const deck = votes[id];
    if (!deck) continue;
    const tally = byDeck.get(deck.id) ?? { deck, voters: [] };
    tally.voters.push(id);
    byDeck.set(deck.id, tally);
  }
  return [...byDeck.values()].sort((a, b) => b.voters.length - a.voters.length);
}

/** How many votes each deck has, for the deck library's tiles. */
export function voteCounts(votes: DeckVotes): Map<string, number> {
  const counts = new Map<string, number>();
  for (const deck of Object.values(votes)) counts.set(deck.id, (counts.get(deck.id) ?? 0) + 1);
  return counts;
}
