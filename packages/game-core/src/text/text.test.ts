import { describe, expect, it } from 'vitest';
import { editDistance } from './distance';
import { normalizeText } from './normalize';

describe('normalizeText', () => {
  it.each([
    ['Séance', 'seance'],
    ['  The   Pumpkin! ', 'pumpkin'],
    ["Witch's hat", 'witch hat'],
    ['Witches hats', 'witch hat'],
    ['Trick-or-treat', 'trick or treat'],
    ['Salt & pepper', 'salt and pepper'],
    ["Don't panic", 'dont panic'],
    ['a', 'a'],
    ['Bus', 'bus'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeText(input)).toBe(expected);
  });
});

describe('editDistance', () => {
  it.each([
    ['pumpkin', 'pumpkin', 0],
    ['pumpkin', 'pumkin', 1],
    ['pumpkin', 'pumpkni', 1], // transposition
    ['cat', 'car', 1],
    ['cat', 'dog', 3],
    ['', 'abc', 3],
    ['pumpkin', 'pump', 3],
  ])('%s ↔ %s = %i', (a, b, d) => {
    expect(editDistance(a, b)).toBe(d);
    expect(editDistance(b, a)).toBe(d);
  });
});
