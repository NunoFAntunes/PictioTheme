import { describe, expect, it } from 'vitest';
import { arrangePodium, BEAT_ORDER, BEATS } from './ceremony';

const players = (...scores: number[]) => scores.map((score, i) => ({ id: `p${i + 1}`, score }));
const ids = (list: { id: string }[]) => list.map((p) => p.id);

describe('podium ceremony', () => {
  it('puts 2nd, 1st and 3rd on the steps, left to right, and the rest in the crowd', () => {
    const podium = arrangePodium(players(1240, 1180, 1100, 860, 790));
    expect(podium.steps.map((s) => [s.rank, ids(s.players)])).toEqual([
      [2, ['p2']],
      [1, ['p1']],
      [3, ['p3']],
    ]);
    expect(podium.crowd.map((c) => [c.player.id, c.rank])).toEqual([
      ['p4', 4],
      ['p5', 5],
    ]);
    expect(podium.last?.id).toBe('p5');
  });

  it('shares a step on a tie and leaves out the place nobody holds', () => {
    const podium = arrangePodium(players(1240, 1240, 1100, 860));
    expect(podium.steps.map((s) => [s.rank, ids(s.players)])).toEqual([
      [1, ['p1', 'p2']],
      [3, ['p3']],
    ]);
    const tieForThird = arrangePodium(players(1240, 1180, 1020, 1020, 790));
    expect(ids(tieForThird.steps.find((s) => s.rank === 3)?.players ?? [])).toEqual(['p3', 'p4']);
    expect(tieForThird.crowd.map((c) => c.rank)).toEqual([5]);
  });

  it('keeps an empty 3rd step for the tumbleweed in a two-player match', () => {
    const podium = arrangePodium(players(900, 400));
    expect(podium.steps.map((s) => [s.rank, ids(s.players)])).toEqual([
      [2, ['p2']],
      [1, ['p1']],
      [3, []],
    ]);
    expect(podium.last?.id).toBe('p2');
  });

  it('has nobody keel over when everyone tied for first', () => {
    const podium = arrangePodium(players(500, 500));
    expect(podium.steps.map((s) => s.rank)).toEqual([1, 3]);
    expect(podium.last).toBeNull();
  });

  it('ranks by score even if the ranking arrives out of order', () => {
    const podium = arrangePodium(players(100, 300, 200));
    expect(podium.steps.map((s) => ids(s.players))).toEqual([['p3'], ['p2'], ['p1']]);
  });

  it('plays the beats in order', () => {
    const times = BEAT_ORDER.map((b) => BEATS[b]);
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(BEAT_ORDER.at(-1)).toBe('idle');
  });
});
