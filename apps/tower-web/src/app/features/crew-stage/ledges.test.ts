import { describe, expect, it } from 'vitest';
import { standPoints } from './ledges';

describe('stand points', () => {
  it('stands one avatar in the middle of a ledge, or on a point', () => {
    expect(standPoints({ left: 0, right: 200, y: 50, size: 40 }, 1)).toEqual([
      { x: 100, y: 50, size: 40 },
    ]);
    expect(standPoints({ left: 30, right: 30, y: 9, size: 52 }, 1)).toEqual([
      { x: 30, y: 9, size: 52 },
    ]);
    expect(standPoints({ left: 0, right: 200, y: 50, size: 40 }, 0)).toEqual([]);
  });

  it('spaces a few avatars evenly round the middle', () => {
    const xs = standPoints({ left: 0, right: 400, y: 0, size: 40 }, 3).map((p) => p.x);
    expect(xs).toEqual([156, 200, 244]);
  });

  it('squeezes, then shrinks, a crowd to fit the ledge', () => {
    const tight = standPoints({ left: 0, right: 100, y: 0, size: 40 }, 3);
    expect(tight.map((p) => p.size)).toEqual([40, 40, 40]);
    expect(tight[0]?.x).toBe(20);
    expect(tight[2]?.x).toBe(80);
    const crowd = standPoints({ left: 0, right: 100, y: 0, size: 40 }, 6);
    const size = crowd[0]?.size ?? 0;
    expect(size).toBeLessThan(40);
    expect((crowd[0]?.x ?? 0) - size / 2).toBeCloseTo(0);
    expect((crowd[5]?.x ?? 0) + size / 2).toBeCloseTo(100);
  });

  it('fills outwards from a gap, alternating sides, and never stands in it', () => {
    const ledge = { left: 0, right: 400, y: 0, size: 40, gap: { left: 160, right: 240 } };
    const points = standPoints(ledge, 4);
    expect(points.map((p) => p.x)).toEqual([140, 260, 96, 304]);
    for (const p of standPoints(ledge, 9)) {
      expect(p.x + p.size / 2 <= 160 || p.x - p.size / 2 >= 240).toBe(true);
      expect(p.x - p.size / 2).toBeGreaterThanOrEqual(-1e-9);
      expect(p.x + p.size / 2).toBeLessThanOrEqual(400 + 1e-9);
    }
  });
});
