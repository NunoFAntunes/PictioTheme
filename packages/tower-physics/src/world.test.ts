import { beforeAll, describe, expect, it } from 'vitest';
import {
  createTowerWorld,
  DEFAULT_TUNING,
  loadPhysics,
  type PieceGeometry,
  type StepEvents,
  type TowerWorld,
} from './world';

beforeAll(loadPhysics);

const polygon = (pts: [number, number][]): PieceGeometry => {
  const flat = pts.flatMap(([x, y]) => [x, y]);
  return { outline: flat, parts: [flat] };
};
const box = (w: number, h: number) =>
  polygon([
    [-w / 2, -h / 2],
    [w / 2, -h / 2],
    [w / 2, h / 2],
    [-w / 2, h / 2],
  ]);
const disc = (r: number) =>
  polygon(
    Array.from({ length: 16 }, (_, i): [number, number] => {
      const a = (i / 16) * 2 * Math.PI;
      return [r * Math.cos(a), r * Math.sin(a)];
    }),
  );
/** A ramp rising to the right, centred on its centroid. */
const ramp = (w: number, h: number) =>
  polygon([
    [-(2 * w) / 3, -h / 3],
    [w / 3, -h / 3],
    [w / 3, (2 * h) / 3],
  ]);

function run(world: TowerWorld, seconds: number) {
  const fumbled: number[] = [];
  let released: StepEvents['released'] = null;
  for (let i = 0; i < seconds * 60; i++) {
    const events = world.step();
    fumbled.push(...events.fumbled);
    released ??= events.released;
  }
  return { fumbled, released };
}

/** Spawns a piece above the tower and lets it come down until it lands, then settle. */
function place(world: TowerWorld, geometry: PieceGeometry, x = 0, angle = 0) {
  const id = world.spawn(geometry, x, world.top() + 3, angle);
  expect(id).not.toBeNull();
  world.steer({ fast: true });
  let released = null;
  for (let i = 0; i < 600 && released === null; i++) released = world.step().released;
  expect(released).toEqual({ id, reason: 'touched' });
  return { id, ...run(world, 3) };
}

describe('placing', () => {
  it('lowers the piece on its own and releases it when it touches the platform', () => {
    const world = createTowerWorld();
    const id = world.spawn(box(2, 1), 0, 4);
    expect(world.active).toBe(id);
    run(world, 1);
    const [body] = world.bodies();
    // Lowered at its own speed for one second, without falling faster under gravity.
    expect(body?.y).toBeCloseTo(4 - DEFAULT_TUNING.lowerSpeed, 1);
    const { released } = run(world, 4);
    expect(released).toEqual({ id, reason: 'touched' });
    expect(world.active).toBeNull();
    world.free();
  });

  it('follows the placer sideways and turns to the target angle, within reach', () => {
    const world = createTowerWorld();
    world.spawn(box(2, 1), 0, 10);
    world.steer({ x: 3, angle: Math.PI / 2 });
    run(world, 1);
    const [body] = world.bodies();
    expect(body?.x).toBeCloseTo(3, 1);
    expect(body?.angle).toBeCloseTo(Math.PI / 2, 1);
    world.steer({ x: 100 });
    expect(world.target?.x).toBe(DEFAULT_TUNING.platformWidth / 2 + DEFAULT_TUNING.reach);
    world.free();
  });

  it('drops straight down when the placer drops it', () => {
    const world = createTowerWorld();
    const id = world.spawn(box(1, 1), 1, 10);
    expect(world.drop()).toBe(id);
    expect(world.active).toBeNull();
    // Reported once, on the next step, and not again when it lands.
    const { released } = run(world, 3);
    expect(released).toEqual({ id, reason: 'dropped' });
    world.spawn(box(1, 1), 1, 10);
    world.drop();
    run(world, 0.5);
    const body = world.bodies().at(-1);
    expect(body?.x).toBeCloseTo(1, 5);
    // Under gravity now: ½ g t² ≈ 1.2 in half a second.
    expect(body?.y).toBeLessThan(9);
    world.free();
  });

  it("can't spawn a second piece while one is being placed", () => {
    const world = createTowerWorld();
    expect(world.spawn(box(1, 1), 0, 5)).not.toBeNull();
    expect(world.spawn(box(1, 1), 0, 8)).toBeNull();
    world.free();
  });
});

describe('stacking', () => {
  it('stacks ten bricks into a stable tower', () => {
    const world = createTowerWorld();
    for (let i = 0; i < 10; i++) expect(place(world, box(3, 1)).fumbled).toEqual([]);
    expect(world.height()).toBeCloseTo(10, 0);
    expect(world.bodies().every((b) => b.settled)).toBe(true);
    world.free();
  });

  it('slides a piece off a slope when friction is low, and holds it when friction is high', () => {
    const slide = (friction: number) => {
      const world = createTowerWorld({ friction });
      place(world, ramp(5, 2.9)); // about 30°
      const { fumbled } = place(world, box(1, 1), 0.5, Math.atan2(2.9, 5));
      const outcome = fumbled.length > 0 || run(world, 8).fumbled.length > 0;
      world.free();
      return outcome;
    };
    expect(slide(0.2)).toBe(true);
    expect(slide(1)).toBe(false);
  });

  it('rolls a ball off a slope', () => {
    const world = createTowerWorld();
    place(world, ramp(5, 1.25));
    world.spawn(disc(0.6), 1, 5);
    world.drop();
    expect(run(world, 10).fumbled).toHaveLength(1);
    world.free();
  });
});

describe('fumbles', () => {
  it('reports a piece that falls off exactly once, and removes it', () => {
    const world = createTowerWorld();
    const id = world.spawn(box(1, 1), 0, 3);
    world.steer({ x: 7 });
    const { fumbled } = run(world, 8);
    expect(fumbled).toEqual([id]);
    expect(world.bodies()).toHaveLength(0);
    expect(world.active).toBeNull();
    world.free();
  });
});

describe('height', () => {
  it("doesn't count the piece being placed, or pieces still moving", () => {
    const world = createTowerWorld();
    place(world, box(4, 2));
    expect(world.height()).toBeCloseTo(2, 1);
    world.spawn(box(1, 1), 0, 2.6);
    expect(world.height()).toBeCloseTo(2, 1);
    world.drop();
    world.step();
    expect(world.height()).toBeCloseTo(2, 1);
    world.free();
  });

  it("doesn't count a piece that isn't standing on the platform", () => {
    const world = createTowerWorld();
    place(world, box(2, 1));
    world.spawn(box(1, 1), 8, 12);
    world.drop();
    // Falling past the platform: never part of the tower.
    for (let i = 0; i < 60; i++) {
      world.step();
      expect(world.height()).toBeCloseTo(1, 1);
    }
    world.free();
  });
});

describe('determinism', () => {
  it('gives identical results for identical inputs', () => {
    const simulate = () => {
      const world = createTowerWorld();
      place(world, box(3, 1), 0.3);
      place(world, ramp(3, 1.5), -0.4, 0.2);
      place(world, disc(0.7), 1.1);
      const out = { bodies: world.bodies(), height: world.height() };
      world.free();
      return out;
    };
    expect(simulate()).toEqual(simulate());
  });
});

describe('performance', () => {
  it('steps a 40-piece tower in well under a frame', () => {
    const world = createTowerWorld();
    for (let i = 0; i < 40; i++) {
      world.spawn(box(1.5, 0.8), ((i % 4) - 1.5) * 1.6, 1 + Math.floor(i / 4) * 0.9);
      world.drop();
    }
    run(world, 2);
    // About 0.05 ms on an M-series laptop; the bound is loose so slow CI machines pass.
    const steps = 600;
    const start = Date.now();
    for (let i = 0; i < steps; i++) world.step();
    expect((Date.now() - start) / steps).toBeLessThan(2);
    world.free();
  });
});
