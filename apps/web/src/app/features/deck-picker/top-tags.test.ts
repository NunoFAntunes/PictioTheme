import { describe, expect, it } from 'vitest';
import { topTags } from './top-tags';

const deck = (...tags: string[]) => ({ tags });

describe('topTags', () => {
  it('orders tags by how many decks have them, then alphabetically', () => {
    const decks = [
      deck('spooky', 'family'),
      deck('family', 'animals'),
      deck('animals', 'family'),
      deck('spooky'),
    ];
    expect(topTags(decks, 5)).toEqual(['family', 'animals', 'spooky']);
  });

  it('leaves out tags only one deck has, and stops at the count', () => {
    const decks = [deck('a', 'b', 'lonely'), deck('a', 'b'), deck('a')];
    expect(topTags(decks, 1)).toEqual(['a']);
    expect(topTags(decks, 5)).toEqual(['a', 'b']);
  });

  it('counts a tag once per deck, ignoring case and spaces', () => {
    expect(topTags([deck('Pirates', ' pirates'), deck('pirates')], 5)).toEqual(['pirates']);
    expect(topTags([deck('Pirates', 'pirates')], 5)).toEqual([]);
  });
});
