import { describe, expect, it } from 'vitest';
import { cardMultiplier, drawerPoints, guesserPoints } from './scoring';

describe('guesserPoints', () => {
  it('gives 300 for an instant guess and 50 at the buzzer', () => {
    const base = { drawTimeMs: 80_000, isFirst: false, multiplier: 1 };
    expect(guesserPoints({ ...base, timeRemainingMs: 80_000 })).toBe(300);
    expect(guesserPoints({ ...base, timeRemainingMs: 0 })).toBe(50);
    expect(guesserPoints({ ...base, timeRemainingMs: 40_000 })).toBe(175);
  });

  it('adds the first-guess bonus and applies the multiplier', () => {
    expect(
      guesserPoints({ drawTimeMs: 80_000, timeRemainingMs: 0, isFirst: true, multiplier: 1.5 }),
    ).toBe(150);
  });

  it('clamps out-of-range time', () => {
    const base = { drawTimeMs: 80_000, isFirst: false, multiplier: 1 };
    expect(guesserPoints({ ...base, timeRemainingMs: -5 })).toBe(50);
    expect(guesserPoints({ ...base, timeRemainingMs: 999_999 })).toBe(300);
  });
});

describe('drawerPoints', () => {
  it('scales with the share of guessers who got it', () => {
    expect(drawerPoints({ correctGuessers: 3, totalGuessers: 4, multiplier: 1 })).toBe(150);
    expect(drawerPoints({ correctGuessers: 0, totalGuessers: 4, multiplier: 1 })).toBe(0);
    expect(drawerPoints({ correctGuessers: 0, totalGuessers: 0, multiplier: 1 })).toBe(0);
  });
});

describe('cardMultiplier', () => {
  it('uses the silly multiplier for silly cards regardless of difficulty', () => {
    expect(cardMultiplier({ difficulty: 'easy', silly: false })).toBe(1);
    expect(cardMultiplier({ difficulty: 'medium', silly: false })).toBe(1.2);
    expect(cardMultiplier({ difficulty: 'hard', silly: false })).toBe(1.5);
    expect(cardMultiplier({ difficulty: 'easy', silly: true })).toBe(1.5);
  });
});
