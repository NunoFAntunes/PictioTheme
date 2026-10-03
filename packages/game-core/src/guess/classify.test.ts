import type { Card, GuessKind } from '@pictiotheme/protocol';
import { describe, expect, it } from 'vitest';
import { classifyGuess, prepareCard } from './classify';

function card(text: string, extra: Partial<Card> = {}): Card {
  return {
    text,
    difficulty: 'easy',
    silly: false,
    alternates: [],
    keywords: text.toLowerCase().split(' '),
    ...extra,
  };
}

const pumpkin = card('Pumpkin');
const witchHat = card('Witch hat', { alternates: ['witches hat'] });
const seance = card('Séance');
const hauntedHouse = card('Haunted house');
const vampireUnicycle = card('Vampire on a unicycle', {
  silly: true,
  alternates: ['vampire riding a unicycle'],
  keywords: ['vampire', 'unicycle'],
});
const realtorSkeleton = card('Realtor skeleton', {
  silly: true,
  alternates: ['real estate agent skeleton', 'skeleton realtor'],
  keywords: ['realtor', 'skeleton'],
});
const cat = card('Cat');

// The starter table from docs/technical/guess-matching.md §4, plus a few edge cases.
const cases: [Card, string, GuessKind][] = [
  [pumpkin, 'pumpkin', 'correct'],
  [pumpkin, 'Pumpkins!', 'correct'],
  [pumpkin, 'pumkin', 'close'],
  [pumpkin, 'pumpkni', 'close'],
  [pumpkin, 'pump', 'wrong'],
  [witchHat, "witch's hat", 'correct'],
  [witchHat, 'hat', 'close'],
  [seance, 'seance', 'correct'],
  [hauntedHouse, 'haunted mansion', 'close'],
  [vampireUnicycle, 'vampire unicycle', 'correct'],
  [vampireUnicycle, 'unicycle vampire', 'correct'],
  [vampireUnicycle, 'vampire riding unicycle', 'correct'],
  [vampireUnicycle, 'vampire', 'close'],
  [vampireUnicycle, 'dracula on a bike', 'wrong'],
  [realtorSkeleton, 'skeleton real estate agent', 'correct'],
  [realtorSkeleton, "a realtor that's a skeleton", 'correct'],
  [cat, 'car', 'close'],
  [cat, 'dog', 'wrong'],
  // Anti-spoiler / forgiving containment (§3)
  [pumpkin, 'is it pumpkin?', 'correct'],
  [pumpkin, 'The Pumpkin', 'correct'],
  [cat, 'cat dog bird fish horse', 'wrong'],
  // Non-silly cards need the exact words, in order
  [hauntedHouse, 'house haunted', 'close'],
  [pumpkin, '   ', 'wrong'],
];

describe('classifyGuess', () => {
  it.each(cases.map(([c, guess, expected]) => [c.text, guess, expected, c] as const))(
    '%s ← "%s" is %s',
    (_text, guess, expected, c) => {
      expect(classifyGuess(prepareCard(c), guess)).toBe(expected);
    },
  );
});
