import type { Card, CardKind } from '@pictiotheme/protocol';
import { describe, expect, it } from 'vitest';
import { buildCardPool, settleOptions, takeOptions } from './card-pool';
import { seededRng } from './rng';

function makeCards(kind: CardKind, n: number): Card[] {
  return Array.from({ length: n }, (_, i) => ({
    text: `${kind} ${i}`,
    kind,
    alternates: [],
    keywords: ['x'],
  }));
}

const deck = [...makeCards('easy', 10), ...makeCards('hard', 10), ...makeCards('chaos', 10)];

describe('buildCardPool', () => {
  it('keeps only the selected difficulties in normal mode, never Chaos cards', () => {
    const pool = buildCardPool(deck, { mode: 'normal', difficulties: ['hard'] }, seededRng(1));
    expect(pool.remaining).toHaveLength(10);
    expect(pool.remaining.every((c) => c.kind === 'hard')).toBe(true);
  });

  it('plays only the Chaos cards in Chaos mode, whatever the difficulties', () => {
    const pool = buildCardPool(deck, { mode: 'chaos', difficulties: ['easy'] }, seededRng(1));
    expect(pool.remaining).toHaveLength(10);
    expect(pool.remaining.every((c) => c.kind === 'chaos')).toBe(true);
  });
});

describe('takeOptions', () => {
  it('offers an easy and a hard card when both are selected', () => {
    const pool = buildCardPool(
      deck,
      { mode: 'normal', difficulties: ['easy', 'hard'] },
      seededRng(3),
    );
    const { options, pool: next } = takeOptions(pool, 3, seededRng(4));
    expect(new Set(options.map((c) => c.kind))).toEqual(new Set(['easy', 'hard']));
    expect(next.remaining).toHaveLength(17);
  });

  it('never repeats the chosen card within a match, and returns the others to the pool', () => {
    const rng = seededRng(5);
    let pool = buildCardPool(deck, { mode: 'normal', difficulties: ['easy', 'hard'] }, rng);
    const drawn = new Set<string>();
    // 20 cards, net -1 per turn: 18 turns fit before the pool must recycle.
    for (let turn = 0; turn < 18; turn++) {
      const taken = takeOptions(pool, 3, rng);
      expect(taken.reshuffled).toBe(false);
      const chosen = taken.options[turn % taken.options.length] as Card;
      expect(drawn.has(chosen.text)).toBe(false);
      drawn.add(chosen.text);
      pool = settleOptions(taken.pool, taken.options, chosen);
    }
    expect(drawn.size).toBe(18);
  });

  it('recycles used cards when the pool runs out and says so', () => {
    const rng = seededRng(6);
    let pool = buildCardPool(makeCards('easy', 4), { mode: 'normal', difficulties: ['easy'] }, rng);
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
