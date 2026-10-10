import { describe, expect, it } from 'vitest';
import {
  cardMultiplier,
  drawerMultiplier,
  drawerPoints,
  guesserPoints,
  orderBonus,
  rushPoints,
  rushWindowMs,
  speedPoints,
} from './scoring';

describe('speedPoints', () => {
  it('gives 300 for an instant guess and 100 at the buzzer', () => {
    expect(speedPoints(80_000, 80_000)).toBe(300);
    expect(speedPoints(40_000, 80_000)).toBe(200);
    expect(speedPoints(0, 80_000)).toBe(100);
  });

  it('clamps out-of-range time', () => {
    expect(speedPoints(-5, 80_000)).toBe(100);
    expect(speedPoints(999_999, 80_000)).toBe(300);
  });
});

describe('guesserPoints', () => {
  it('adds the order bonus for the first three, then applies the multiplier', () => {
    expect([1, 2, 3, 4].map(orderBonus)).toEqual([100, 50, 25, 0]);
    expect(guesserPoints({ base: 200, order: 1, multiplier: 1 })).toBe(300);
    expect(guesserPoints({ base: 200, order: 4, multiplier: 1 })).toBe(200);
    expect(guesserPoints({ base: 100, order: 2, multiplier: 1.5 })).toBe(225);
  });
});

describe('rush', () => {
  it('drains from the first guesser’s points to the minimum', () => {
    expect(rushPoints(260, 20_000, 20_000)).toBe(260);
    expect(rushPoints(260, 10_000, 20_000)).toBe(180);
    expect(rushPoints(260, 0, 20_000)).toBe(100);
  });

  it('lasts a quarter of the draw time, 15 to 30 seconds', () => {
    expect(rushWindowMs(80_000)).toBe(20_000);
    expect(rushWindowMs(30_000)).toBe(15_000);
    expect(rushWindowMs(180_000)).toBe(30_000);
  });
});

describe('drawerPoints', () => {
  const base = { totalGuessers: 4, multiplier: 1 };

  it('is full once half the guessers got it, and no more after that', () => {
    expect(drawerPoints({ ...base, correctGuessers: 1 })).toBe(100);
    expect(drawerPoints({ ...base, correctGuessers: 2 })).toBe(200);
    expect(drawerPoints({ ...base, correctGuessers: 4 })).toBe(200);
  });

  it('is 0 if nobody got it', () => {
    expect(drawerPoints({ ...base, correctGuessers: 0 })).toBe(0);
    expect(drawerPoints({ correctGuessers: 0, totalGuessers: 0, multiplier: 1 })).toBe(0);
  });

  it('grows with the room, counting 2 to 8 guessers', () => {
    expect(drawerPoints({ correctGuessers: 1, totalGuessers: 1, multiplier: 1 })).toBe(100);
    expect(drawerPoints({ correctGuessers: 6, totalGuessers: 12, multiplier: 1 })).toBe(400);
  });

  it('makes a hard card worth the risk', () => {
    const points = (difficulty: 'easy' | 'hard', correctGuessers: number) =>
      drawerPoints({
        correctGuessers,
        totalGuessers: 8,
        multiplier: drawerMultiplier({ difficulty, silly: false }),
      });
    // Everyone gets "Bat"; a quarter get "Headless horseman": the drawer is no worse off.
    expect(points('hard', 2)).toBe(points('easy', 8));
    expect(points('hard', 4)).toBe(2 * points('easy', 8));
  });
});

describe('multipliers', () => {
  it('uses the silly multiplier for silly cards regardless of difficulty', () => {
    expect(cardMultiplier({ difficulty: 'easy', silly: false })).toBe(1);
    expect(cardMultiplier({ difficulty: 'medium', silly: false })).toBe(1.2);
    expect(cardMultiplier({ difficulty: 'hard', silly: false })).toBe(1.5);
    expect(cardMultiplier({ difficulty: 'easy', silly: true })).toBe(1.5);
  });

  it('gives the drawer a steeper one', () => {
    expect(drawerMultiplier({ difficulty: 'easy', silly: false })).toBe(1);
    expect(drawerMultiplier({ difficulty: 'medium', silly: false })).toBe(1.4);
    expect(drawerMultiplier({ difficulty: 'hard', silly: false })).toBe(2);
    expect(drawerMultiplier({ difficulty: 'easy', silly: true })).toBe(2);
  });
});
