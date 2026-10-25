import { describe, expect, it } from 'vitest';
import {
  BIRD_FLY_MS,
  CARRY_BELOW,
  createMagpieFlight,
  createPigeonFlight,
  createPigeonFlights,
  type MagpieInput,
} from './birds';

describe('the pigeon', () => {
  it('flies in to its perch from its side, perches, then flies off that way', () => {
    const fly = createPigeonFlight();
    const perch = { x: 1.2, y: 3 };
    const arriving = fly(perch, 0);
    expect(arriving).toMatchObject({ kind: 'pigeon', flying: true, facing: -1 });
    expect(arriving?.x).toBeGreaterThan(perch.x);
    expect(arriving?.y).toBeGreaterThan(perch.y);
    expect(fly(perch, BIRD_FLY_MS / 2)?.flying).toBe(true);
    expect(fly(perch, BIRD_FLY_MS)).toEqual({
      kind: 'pigeon',
      ...perch,
      facing: -1,
      flying: false,
    });
    // It follows its perch as the piece tips.
    expect(fly({ x: 1.3, y: 2.9 }, 5_000)).toMatchObject({ x: 1.3, y: 2.9, flying: false });
    // It leaves from the first frame it's gone.
    expect(fly(null, 5_100)).toMatchObject({ x: 1.3, y: 2.9, flying: true, facing: 1 });
    const leaving = fly(null, 5_100 + BIRD_FLY_MS / 2);
    expect(leaving?.x).toBeGreaterThan(1.3);
    expect(fly(null, 5_100 + BIRD_FLY_MS)).toBeNull();
    expect(fly(null, 9_000)).toBeNull();
  });
});

describe('the pigeons', () => {
  it('fly in one after another, each to its own perch, and leave on their own', () => {
    const fly = createPigeonFlights();
    const perches = [
      { id: -1, x: 1, y: 3 },
      { id: -2, x: -1.5, y: 2 },
      { id: -3, x: 2, y: 1 },
    ];
    expect(fly(perches, 0)).toHaveLength(1);
    const settled = fly(perches, 5_000);
    expect(settled.map((b) => [b.x, b.y, b.flying])).toEqual([
      [1, 3, false],
      [-1.5, 2, false],
      [2, 1, false],
    ]);
    // One scared off: it flies away, the others stay.
    const left = fly(
      [perches[0], perches[2]].filter((p) => p !== undefined),
      5_100,
    );
    expect(left.filter((b) => b.flying)).toHaveLength(1);
    expect(left.filter((b) => !b.flying)).toHaveLength(2);
    expect(fly([], 6_000)).toHaveLength(2);
    expect(fly([], 6_000 + BIRD_FLY_MS)).toEqual([]);
  });
});

describe('the magpie', () => {
  const top = { x: 0.5, y: 3, angle: 0.3 };
  const quiet: MagpieInput = {
    now: 0,
    takesAt: null,
    top,
    side: 1,
    took: null,
    brought: null,
  };
  const grab = { x: top.x, y: top.y + CARRY_BELOW };

  it('flies in from the other tower to the top piece just as the spell starts', () => {
    const fly = createMagpieFlight();
    expect(fly({ ...quiet, now: 1_000, takesAt: 3_000 }).birds).toEqual([]);
    const [arriving] = fly({ ...quiet, now: 3_000 - BIRD_FLY_MS, takesAt: 3_000 }).birds;
    expect(arriving).toMatchObject({ kind: 'magpie', flying: true, facing: -1 });
    expect(arriving?.x).toBeGreaterThan(4);
    const [there] = fly({ ...quiet, now: 3_200, takesAt: 3_000 }).birds;
    expect(there?.x).toBeCloseTo(grab.x, 5);
    expect(Math.abs((there?.y ?? 0) - grab.y)).toBeLessThan(0.1);
  });

  it('flies off with the top piece it took, as it stood, back towards the thief', () => {
    const fly = createMagpieFlight();
    fly({ ...quiet, now: 3_100, takesAt: 3_000 });
    const took = { at: 3_150, pieceId: 7 };
    const [leaving] = fly({ ...quiet, now: 3_150, takesAt: 3_000, took }).birds;
    expect(leaving).toMatchObject({ carrying: 7, facing: 1, carrySize: 1 });
    expect(leaving?.carryAngle).toBeCloseTo(0.3, 5);
    const [later] = fly({ ...quiet, now: 3_150 + BIRD_FLY_MS / 2, took }).birds;
    expect(later?.carryAngle).toBe(0);
    expect(later?.x).toBeGreaterThan(grab.x);
    expect(fly({ ...quiet, now: 3_150 + BIRD_FLY_MS, took }).birds).toEqual([]);
  });

  it('flies off empty-handed when there was nothing to take', () => {
    const fly = createMagpieFlight();
    fly({ ...quiet, top: null, now: 3_100, takesAt: 3_000 });
    const [leaving] = fly({ ...quiet, top: null, now: 3_200 }).birds;
    expect(leaving).toMatchObject({ flying: true, facing: 1 });
    expect(leaving?.carrying).toBeUndefined();
  });

  it('brings the piece it took in to its balloons, hidden until it lets go', () => {
    const fly = createMagpieFlight();
    const brought = { at: 1_000, pieceId: 4, to: { x: 0.5, y: 6 } };
    const onItsWay = fly({ ...quiet, now: 500, brought });
    expect(onItsWay.hide).toBe(4);
    expect(onItsWay.birds).toEqual([]);
    const arriving = fly({ ...quiet, now: 1_000 + BIRD_FLY_MS / 2, brought });
    expect(arriving.hide).toBe(4);
    expect(arriving.birds[0]).toMatchObject({ carrying: 4, facing: -1 });
    const leaving = fly({ ...quiet, now: 1_000 + BIRD_FLY_MS * 1.2, brought });
    expect(leaving.hide).toBeNull();
    expect(leaving.birds[0]?.carrying).toBeUndefined();
    expect(fly({ ...quiet, now: 1_000 + BIRD_FLY_MS * 2, brought }).birds).toEqual([]);
  });
});
