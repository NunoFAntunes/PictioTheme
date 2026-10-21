import { describe, expect, it } from 'vitest';
import { BIRD_FLY_MS, createMagpieFlight, createPigeonFlight, type MagpieInput } from './birds';

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

describe('the magpie', () => {
  const quiet: MagpieInput = {
    now: 0,
    circlingSince: null,
    top: 2,
    side: 1,
    took: null,
    brought: null,
  };

  it('flies in from the other tower and circles over the top', () => {
    const fly = createMagpieFlight();
    const [arriving] = fly({ ...quiet, now: 1_000, circlingSince: 1_000 }).birds;
    expect(arriving).toMatchObject({ kind: 'magpie', flying: true, facing: -1 });
    expect(arriving?.x).toBeGreaterThan(4);
    for (let now = 2_000; now < 8_000; now += 500) {
      const [bird] = fly({ ...quiet, now, circlingSince: 1_000 }).birds;
      expect(Math.abs(bird?.x ?? 99)).toBeLessThan(2);
      expect(bird?.y).toBeGreaterThan(3.5);
    }
  });

  it('flies off with the piece it took, back towards the thief', () => {
    const fly = createMagpieFlight();
    fly({ ...quiet, now: 5_000, circlingSince: 1_000 });
    const took = { at: 5_100, pieceId: 7 };
    const [leaving] = fly({ ...quiet, now: 5_100, took }).birds;
    expect(leaving).toMatchObject({ carrying: 7, facing: 1 });
    expect(fly({ ...quiet, now: 5_100 + BIRD_FLY_MS, took }).birds).toEqual([]);
  });

  it('swoops in and out with a piece that was already waiting', () => {
    const fly = createMagpieFlight();
    const took = { at: 1_000, pieceId: 3 };
    const [arriving] = fly({ ...quiet, now: 1_000, took }).birds;
    expect(arriving?.carrying).toBeUndefined();
    const [leaving] = fly({ ...quiet, now: 1_000 + BIRD_FLY_MS * 1.5, took }).birds;
    expect(leaving?.carrying).toBe(3);
    expect(fly({ ...quiet, now: 1_000 + BIRD_FLY_MS * 2, took }).birds).toEqual([]);
  });

  it('gives up empty-handed', () => {
    const fly = createMagpieFlight();
    fly({ ...quiet, now: 30_000, circlingSince: 1_000 });
    const [leaving] = fly({ ...quiet, now: 31_000 }).birds;
    expect(leaving?.carrying).toBeUndefined();
  });

  it('brings the piece it took in to its balloons, hidden until it lets go', () => {
    const fly = createMagpieFlight();
    const brought = { at: 1_000, pieceId: 4, to: { x: 0.5, y: 6 } };
    const arriving = fly({ ...quiet, now: 1_000 + BIRD_FLY_MS / 2, brought });
    expect(arriving.hide).toBe(4);
    expect(arriving.birds[0]).toMatchObject({ carrying: 4, facing: -1 });
    const leaving = fly({ ...quiet, now: 1_000 + BIRD_FLY_MS * 1.2, brought });
    expect(leaving.hide).toBeNull();
    expect(leaving.birds[0]?.carrying).toBeUndefined();
    expect(fly({ ...quiet, now: 1_000 + BIRD_FLY_MS * 2, brought }).birds).toEqual([]);
  });
});
