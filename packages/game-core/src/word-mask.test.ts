import { describe, expect, it } from 'vitest';
import { seededRng } from './rng';
import { buildMask, maxHints, pickHintIndex } from './word-mask';

describe('buildMask', () => {
  it('hides letters and keeps spaces, hyphens and digits', () => {
    expect(buildMask('Witch hat')).toBe('_____ ___');
    expect(buildMask('Trick-or-treat')).toBe('_____-__-_____');
    expect(buildMask('7 dwarfs')).toBe('7 ______');
  });

  it('shows revealed letters', () => {
    expect(buildMask('Bat', new Set([0]))).toBe('B__');
  });
});

describe('hints', () => {
  it('never reveals more than a third of the letters', () => {
    const word = 'Haunted house'; // 12 letters → 4 hints max
    expect(maxHints(word)).toBe(4);
    const rng = seededRng(9);
    const revealed = new Set<number>();
    for (;;) {
      const idx = pickHintIndex(word, revealed, rng);
      if (idx === null) break;
      expect(revealed.has(idx)).toBe(false);
      expect(word[idx]).not.toBe(' ');
      revealed.add(idx);
    }
    expect(revealed.size).toBe(4);
  });

  it('gives no hints for very short words', () => {
    expect(pickHintIndex('Ox', new Set(), seededRng(1))).toBeNull();
  });
});
