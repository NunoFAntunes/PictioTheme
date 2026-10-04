import { describe, expect, it } from 'vitest';
import { overtakers, rankByScore } from './leaderboard';

const p = (id: string, score: number) => ({ id, score });

describe('rankByScore', () => {
  it('sorts by score and shares ranks on ties, keeping join order', () => {
    const ranked = rankByScore([p('a', 100), p('b', 300), p('c', 100), p('d', 0)]);
    expect(ranked.map((r) => [r.player.id, r.rank])).toEqual([
      ['b', 1],
      ['a', 2],
      ['c', 2],
      ['d', 4],
    ]);
  });

  it('does not reorder the input (the drawing order)', () => {
    const players = [p('a', 0), p('b', 50)];
    rankByScore(players);
    expect(players.map((x) => x.id)).toEqual(['a', 'b']);
  });
});

describe('overtakers', () => {
  const before = new Map([
    ['a', 1],
    ['b', 2],
    ['c', 3],
  ]);

  it('flags whoever passed someone', () => {
    const after = rankByScore([p('a', 100), p('b', 200), p('c', 100), p('new', 500)]);
    expect([...overtakers(before, after)]).toEqual(['b']);
  });

  it('does not flag catching up to a tie or being pushed down', () => {
    const after = rankByScore([p('a', 100), p('b', 100), p('c', 50)]);
    expect(overtakers(before, after).size).toBe(0);
  });
});
