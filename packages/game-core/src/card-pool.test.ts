import type { Card, Difficulty } from '@pictiotheme/protocol';
import { describe, expect, it } from 'vitest';
import { buildCardPool, settleOptions, takeOptions } from './card-pool';
import { seededRng } from './rng';

function makeCards(difficulty: Difficulty, n: number, silly = false): Card[] {
  return Array.from({ length: n }, (_, i) => ({
    text: `${silly ? 'silly' : difficulty} ${i}`,
    difficulty,
    silly,
    alternates: [],
    keywords: ['x'],
  }));
}

const deck = [
  ...makeCards('easy', 10),
  ...makeCards('medium', 10),
  ...makeCards('hard', 10),
  ...makeCards('medium', 10, true),
];

describe('buildCardPool', () => {
  it('keeps only the selected difficulties and no silly cards when Silly Mode is off', () => {
    const pool = buildCardPool(
      deck,
      { difficulties: ['easy', 'hard'], silly: { enabled: false, ratio: 0.25 } },
      seededRng(1),
    );
    expect(pool.remaining).toHaveLength(20);
    expect(pool.remaining.every((c) => !c.silly && c.difficulty !== 'medium')).toBe(true);
  });

  it('mixes silly cards in at roughly the configured ratio', () => {
    const pool = buildCardPool(
      deck,
      { difficulties: ['easy', 'medium', 'hard'], silly: { enabled: true, ratio: 0.25 } },
      seededRng(1),
    );
    // 30 normal cards at 25% silly → 10 silly cards.
    expect(pool.remaining.filter((c) => c.silly)).toHaveLength(10);
    expect(pool.remaining).toHaveLength(40);
  });

  it('applies the difficulty filter to silly cards too', () => {
    const pool = buildCardPool(
      deck,
      { difficulties: ['easy'], silly: { enabled: true, ratio: 0.5 } },
      seededRng(1),
    );
    expect(pool.remaining.some((c) => c.silly)).toBe(false);
  });
});

describe('takeOptions', () => {
  it('offers one card per difficulty when possible', () => {
    const pool = buildCardPool(
      deck,
      { difficulties: ['easy', 'medium', 'hard'], silly: { enabled: false, ratio: 0 } },
      seededRng(3),
    );
    const { options, pool: next } = takeOptions(pool, 3, seededRng(4));
    expect(new Set(options.map((c) => c.difficulty))).toEqual(new Set(['easy', 'medium', 'hard']));
    expect(next.remaining).toHaveLength(27);
  });

  it('never repeats the chosen card within a match, and returns the others to the pool', () => {
    const rng = seededRng(5);
    let pool = buildCardPool(
      deck,
      { difficulties: ['easy', 'medium', 'hard'], silly: { enabled: false, ratio: 0 } },
      rng,
    );
    const drawn = new Set<string>();
    // 30 cards, net -1 per turn: 28 turns fit before the pool must recycle.
    for (let turn = 0; turn < 28; turn++) {
      const taken = takeOptions(pool, 3, rng);
      expect(taken.reshuffled).toBe(false);
      const chosen = taken.options[turn % taken.options.length] as Card;
      expect(drawn.has(chosen.text)).toBe(false);
      drawn.add(chosen.text);
      pool = settleOptions(taken.pool, taken.options, chosen);
    }
    expect(drawn.size).toBe(28);
  });

  it('recycles used cards when the pool runs out and says so', () => {
    const rng = seededRng(6);
    let pool = buildCardPool(
      makeCards('easy', 4),
      { difficulties: ['easy'], silly: { enabled: false, ratio: 0 } },
      rng,
    );
    const first = takeOptions(pool, 3, rng);
    pool = settleOptions(first.pool, first.options, first.options[0] as Card);
    const second = takeOptions(pool, 3, rng);
    pool = settleOptions(second.pool, second.options, second.options[0] as Card);
    // 2 cards left, 2 used → the next draw must recycle.
    const third = takeOptions(pool, 3, rng);
    expect(third.reshuffled).toBe(true);
    expect(third.options).toHaveLength(3);
  });
});
