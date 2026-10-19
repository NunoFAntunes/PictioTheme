import type { PlayerId, VotedDeck } from '@pictiotheme/protocol';
import { sendError, sendToAll } from './output';
import type { Ctx } from './types';

/**
 * Deck votes (game-rules.md#deck-votes): before a match and at its results, anyone can hold up a
 * paddle with the deck they'd like to play next. The host sees them and decides; nothing is picked
 * automatically. The shell looks each deck up (`lookupDeckVote`), so a paddle only ever shows a
 * real deck's title and cover. Votes are cleared when a match starts, and a player's when they
 * leave.
 */

function canVote(c: Ctx): boolean {
  const { kind } = c.state.phase;
  return kind === 'waiting' || kind === 'results';
}

function broadcastVotes(c: Ctx): void {
  sendToAll(c, { t: 'deck:votes', votes: Object.fromEntries(c.state.deckVotes) });
}

export function onDeckVote(c: Ctx, playerId: PlayerId, deckId: string | null): void {
  const { deckVotes, deckVoteLookups } = c.state;
  if (!canVote(c)) {
    sendError(c, playerId, 'WRONG_PHASE', 'You can vote for a deck between matches');
    return;
  }
  if (deckId === null) {
    deckVoteLookups.delete(playerId);
    if (deckVotes.delete(playerId)) broadcastVotes(c);
    return;
  }
  if (deckVotes.get(playerId)?.id === deckId) {
    deckVoteLookups.delete(playerId); // back to the deck already held up
    return;
  }
  if (deckVoteLookups.get(playerId) === deckId) return;
  deckVoteLookups.set(playerId, deckId);
  c.fx.push({ kind: 'lookupDeckVote', playerId, deckId });
}

export function onDeckVoteFound(
  c: Ctx,
  playerId: PlayerId,
  deckId: string,
  deck: VotedDeck | null,
): void {
  const { deckVotes, deckVoteLookups, players } = c.state;
  // Only the latest vote counts, from someone still here, while voting is still open.
  if (deckVoteLookups.get(playerId) !== deckId) return;
  deckVoteLookups.delete(playerId);
  if (!players.has(playerId) || !canVote(c)) return;
  if (!deck) {
    sendError(c, playerId, 'NOT_FOUND', "That deck isn't available");
    return;
  }
  deckVotes.set(playerId, deck);
  broadcastVotes(c);
}

/** A player left the room: their paddle goes with them. */
export function dropDeckVote(c: Ctx, playerId: PlayerId): void {
  c.state.deckVoteLookups.delete(playerId);
  if (c.state.deckVotes.delete(playerId)) broadcastVotes(c);
}

/** A match starts: the votes were for it, so everyone's paddle goes down. */
export function clearDeckVotes(c: Ctx): void {
  c.state.deckVoteLookups.clear();
  if (c.state.deckVotes.size === 0) return;
  c.state.deckVotes.clear();
  broadcastVotes(c);
}
