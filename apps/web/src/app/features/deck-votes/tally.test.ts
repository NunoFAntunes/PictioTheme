import type { VotedDeck } from '@pictiotheme/protocol';
import { describe, expect, it } from 'vitest';
import { tallyVotes, voteCounts } from './tally';

const deck = (id: string): VotedDeck => ({ id, title: id, coverId: null, language: 'en' });

describe('deck vote tally', () => {
  it('groups voters by deck, most voted first, ties in player order', () => {
    const votes = { ana: deck('space'), bo: deck('ocean'), cy: deck('ocean'), di: deck('farm') };
    const tally = tallyVotes(votes, ['di', 'ana', 'bo', 'cy', 'ed']);
    expect(tally.map((t) => [t.deck.id, t.voters])).toEqual([
      ['ocean', ['bo', 'cy']],
      ['farm', ['di']],
      ['space', ['ana']],
    ]);
  });

  it('ignores votes from players no longer listed', () => {
    expect(tallyVotes({ gone: deck('space') }, ['ana'])).toEqual([]);
  });

  it('counts votes per deck', () => {
    const counts = voteCounts({ ana: deck('space'), bo: deck('space'), cy: deck('farm') });
    expect(Object.fromEntries(counts)).toEqual({ space: 2, farm: 1 });
  });
});
