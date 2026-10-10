import { describe, expect, it } from 'vitest';
import { seededRng } from './rng';
import { buildMask, hintFraction, maxHints, pickHintIndex } from './word-mask';

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
  it('gives one hint per 5 letters, at most a third of each word', () => {
    expect(maxHints('Cat')).toBe(1);
    expect(maxHints('Moon')).toBe(1);
    expect(maxHints('Pumpkin')).toBe(2);
    expect(maxHints('Haunted house')).toBe(3);
    expect(maxHints('Headless horseman')).toBe(4);
    // "on" and "a" are too short for hints.
    expect(maxHints('Vampire on a unicycle')).toBe(4);
    expect(maxHints('Ox')).toBe(0);
  });

  it('reveals hidden letters only, a letter in each word before a second in any', () => {
    const word = 'Headless horseman';
    const rng = seededRng(9);
    const revealed = new Set<number>();
    const words: number[] = [];
    for (;;) {
      const idx = pickHintIndex(word, revealed, rng);
      if (idx === null) break;
      expect(revealed.has(idx)).toBe(false);
      expect(word[idx]).not.toBe(' ');
      revealed.add(idx);
      words.push(idx < 8 ? 0 : 1);
    }
    expect(revealed.size).toBe(4);
    expect(new Set(words.slice(0, 2)).size).toBe(2);
  });

  it('leaves a word’s first letter for last', () => {
    for (let seed = 0; seed < 20; seed++) {
      expect(pickHintIndex('Pumpkin', new Set(), seededRng(seed))).not.toBe(0);
    }
  });

  it('gives no hints for very short words', () => {
    expect(pickHintIndex('Ox', new Set(), seededRng(1))).toBeNull();
  });

  it('spreads hints from half to four fifths of the time', () => {
    expect(hintFraction(0, 1)).toBe(0.5);
    expect([0, 1, 2, 3].map((k) => hintFraction(k, 4))).toEqual([0.5, 0.6, 0.7, 0.8]);
  });
});
