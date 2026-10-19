import type { VotedDeck } from '@pictiotheme/protocol';
import { describe, expect, it } from 'vitest';
import { createHarness, receivedOfType } from './test-harness';
import { TIMINGS } from './types';

const SPACE: VotedDeck = { id: 'deck-space', title: 'Space', coverId: null, language: 'en' };
const OCEAN: VotedDeck = { id: 'deck-ocean', title: 'Ocean', coverId: null, language: 'en' };

/** A room in the waiting phase with p1 (host), p2 and p3. */
function waitingRoom() {
  const h = createHarness();
  h.init();
  for (const id of ['p1', 'p2', 'p3']) h.join(id);
  return h;
}

/** `playerId` votes for `deck`, and the shell finds it. Returns the effects of both. */
function vote(h: ReturnType<typeof createHarness>, playerId: string, deck: VotedDeck) {
  const asked = h.send(playerId, { t: 'deck:vote', deckId: deck.id });
  return [...asked, ...h.dispatch({ type: 'deckVoteFound', playerId, deckId: deck.id, deck })];
}

describe('deck votes', () => {
  it('looks the deck up, then shows everyone the paddle', () => {
    const h = waitingRoom();
    const asked = h.send('p2', { t: 'deck:vote', deckId: SPACE.id });
    expect(asked).toEqual([{ kind: 'lookupDeckVote', playerId: 'p2', deckId: SPACE.id }]);

    const fx = h.dispatch({ type: 'deckVoteFound', playerId: 'p2', deckId: SPACE.id, deck: SPACE });
    for (const p of ['p1', 'p2', 'p3']) {
      expect(receivedOfType(fx, p, 'deck:votes')).toEqual([
        { t: 'deck:votes', votes: { p2: SPACE } },
      ]);
    }
  });

  it('a change of mind replaces the vote, and null puts the paddle down', () => {
    const h = waitingRoom();
    vote(h, 'p2', SPACE);
    vote(h, 'p3', SPACE);
    const fx = vote(h, 'p2', OCEAN);
    expect(receivedOfType(fx, 'p1', 'deck:votes')).toEqual([
      { t: 'deck:votes', votes: { p2: OCEAN, p3: SPACE } },
    ]);
    // The deck already held up: nothing to look up.
    expect(h.send('p2', { t: 'deck:vote', deckId: OCEAN.id })).toEqual([]);

    const down = h.send('p2', { t: 'deck:vote', deckId: null });
    expect(receivedOfType(down, 'p1', 'deck:votes')).toEqual([
      { t: 'deck:votes', votes: { p3: SPACE } },
    ]);
    expect(h.send('p2', { t: 'deck:vote', deckId: null })).toEqual([]);
  });

  it('only the latest vote counts when lookups answer out of order', () => {
    const h = waitingRoom();
    h.send('p2', { t: 'deck:vote', deckId: SPACE.id });
    h.send('p2', { t: 'deck:vote', deckId: OCEAN.id });
    h.dispatch({ type: 'deckVoteFound', playerId: 'p2', deckId: OCEAN.id, deck: OCEAN });
    const late = h.dispatch({
      type: 'deckVoteFound',
      playerId: 'p2',
      deckId: SPACE.id,
      deck: SPACE,
    });
    expect(late).toEqual([]);
    expect(h.state.deckVotes.get('p2')).toEqual(OCEAN);
  });

  it('a deck that does not exist is an error for the voter only', () => {
    const h = waitingRoom();
    h.send('p2', { t: 'deck:vote', deckId: 'nope' });
    const fx = h.dispatch({ type: 'deckVoteFound', playerId: 'p2', deckId: 'nope', deck: null });
    expect(receivedOfType(fx, 'p2', 'error')[0]?.code).toBe('NOT_FOUND');
    expect(receivedOfType(fx, 'p1', 'deck:votes')).toEqual([]);
    expect(h.state.deckVotes.size).toBe(0);
  });

  it('votes are cleared when a match starts, and open again at the results', () => {
    const h = waitingRoom();
    vote(h, 'p2', SPACE);
    vote(h, 'p1', OCEAN); // the host may vote too
    const start = h.send('p1', { t: 'room:start' });
    expect(receivedOfType(start, 'p3', 'deck:votes')).toEqual([{ t: 'deck:votes', votes: {} }]);

    // Not during the match.
    const during = h.send('p2', { t: 'deck:vote', deckId: SPACE.id });
    expect(receivedOfType(during, 'p2', 'error')[0]?.code).toBe('WRONG_PHASE');

    h.send('p1', { t: 'room:end' });
    expect(h.state.phase.kind).toBe('results');
    vote(h, 'p3', OCEAN);
    expect(Object.fromEntries(h.state.deckVotes)).toEqual({ p3: OCEAN });
  });

  it('a lookup that answers after the match started is dropped', () => {
    const h = waitingRoom();
    h.send('p2', { t: 'deck:vote', deckId: SPACE.id });
    h.send('p1', { t: 'room:start' });
    h.dispatch({ type: 'deckVoteFound', playerId: 'p2', deckId: SPACE.id, deck: SPACE });
    expect(h.state.deckVotes.size).toBe(0);
  });

  it('a player who leaves takes their paddle with them; a reconnect keeps it', () => {
    const h = waitingRoom();
    vote(h, 'p2', SPACE);
    vote(h, 'p3', OCEAN);

    h.disconnect('p2');
    const back = h.join('p2');
    expect(receivedOfType(back, 'p2', 'room:snapshot')[0]?.deckVotes).toEqual({
      p2: SPACE,
      p3: OCEAN,
    });

    h.disconnect('p3');
    const fx = h.advance(TIMINGS.playerGraceMs);
    expect(receivedOfType(fx, 'p1', 'deck:votes')).toEqual([
      { t: 'deck:votes', votes: { p2: SPACE } },
    ]);
  });
});
