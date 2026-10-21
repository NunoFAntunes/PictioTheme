import { beforeAll, describe, expect, it } from 'vitest';
import {
  createTowerWorld,
  DEFAULT_TUNING,
  loadPhysics,
  PIGEON_ID,
  type PieceGeometry,
  type PieceMaterial,
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
function place(
  world: TowerWorld,
  geometry: PieceGeometry,
  x = 0,
  angle = 0,
  material: PieceMaterial = {},
) {
  const id = world.spawn(geometry, x, world.top() + 3, angle, undefined, material);
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

  it('lowers a piece faster when its material says so', () => {
    const world = createTowerWorld();
    world.spawn(box(1, 1), 0, 8, 0, undefined, { lowerScale: 2 });
    run(world, 1);
    expect(world.bodies()[0]?.y).toBeCloseTo(8 - 2 * DEFAULT_TUNING.lowerSpeed, 1);
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

  it('slides a slippery piece off a gentle slope that holds an ordinary one', () => {
    const slide = (material: PieceMaterial) => {
      const world = createTowerWorld();
      place(world, ramp(5, 1.34)); // about 15°
      const { fumbled } = place(world, box(1, 1), 0.5, Math.atan2(1.34, 5), material);
      const outcome = fumbled.length > 0 || run(world, 8).fumbled.length > 0;
      world.free();
      return outcome;
    };
    expect(slide({})).toBe(false);
    expect(slide({ friction: 0.05 })).toBe(true);
  });

  it('bounces a bouncy piece, for a while after it lands', () => {
    /** How high a box dropped from 3 m bounces back after first touching the platform. */
    const bounce = (material: PieceMaterial) => {
      const world = createTowerWorld();
      world.spawn(box(1, 1), 0, 3, 0, undefined, material);
      world.drop();
      let landed = false;
      let peak = -Infinity;
      for (let i = 0; i < 180; i++) {
        world.step();
        const body = world.bodies()[0];
        if (!body) break;
        const vy = world.velocity(body.id)?.y ?? 0;
        if (!landed && body.y < 0.6) landed = true;
        if (landed) peak = Math.max(peak, body.y);
        if (landed && vy < 0 && peak > 0.6) break;
      }
      world.free();
      return peak - 0.5;
    };
    const plain = bounce({});
    expect(bounce({ restitution: 0.6, bouncyMs: 3000 })).toBeGreaterThan(plain + 0.3);
    // Its bounce is gone once its time is up (here: right away).
    expect(bounce({ restitution: 0.6, bouncyMs: 0 })).toBeLessThan(plain + 0.05);
  });

  it('keeps a piece slippery when the tuning changes', () => {
    const world = createTowerWorld();
    place(world, ramp(5, 1.34));
    const { fumbled } = place(world, box(1, 1), 0.5, Math.atan2(1.34, 5), { friction: 0.05 });
    world.retune({ friction: 0.9 });
    expect(fumbled.length > 0 || run(world, 8).fumbled.length > 0).toBe(true);
    world.free();
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

describe('ids and frames', () => {
  it('spawns with the id it is given, above the tower, and encodes frames in mm and mrad', () => {
    const world = createTowerWorld();
    place(world, box(2, 1));
    expect(world.spawnAbove(box(1, 1), 3, 42)).toBe(42);
    const active = world.bodies().find((b) => b.id === 42);
    // The tower is 1 high: 3 above it, plus the box's radius (√0.5).
    expect(active?.y).toBeCloseTo(1 + 3 + Math.SQRT1_2, 3);
    const frame = world.frame(false);
    expect(frame).toHaveLength(8);
    expect(frame.slice(4)).toEqual([42, 0, Math.round((active?.y ?? 0) * 1000), 0]);
    // The brick has gone to sleep: only the falling piece is "moving".
    run(world, 0.1);
    expect(world.frame(true).filter((_, i) => i % 4 === 0)).toEqual([42]);
    // The next id the world picks itself doesn't collide.
    world.drop();
    expect(world.spawnAbove(box(1, 1), 3)).toBe(43);
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

describe('sky star', () => {
  it('lets a piece being placed pass through it', () => {
    const world = createTowerWorld();
    world.setStar(0, 2, 0.35);
    const id = world.spawn(box(1, 1), 0, 4);
    world.steer({ fast: true });
    let released = null;
    for (let i = 0; i < 600 && released === null; i++) released = world.step().released;
    expect(released).toEqual({ id, reason: 'touched' });
    // It came all the way down to the platform: the star didn't stop it.
    expect(world.bodies()[0]?.y).toBeLessThan(1);
    world.free();
  });

  it('is held by a settled piece of the tower that touches it, not by one that misses it', () => {
    const world = createTowerWorld();
    world.setStar(3.6, 0.7, 0.35);
    place(world, box(1, 1), 0);
    expect(world.starHeld()).toBe(false);
    // A plank on the platform sticking out past its edge (3), its top (0.5) into the star.
    place(world, box(3, 0.5), 2.4);
    expect(world.starHeld()).toBe(true);
    world.clearStar();
    expect(world.starHeld()).toBe(false);
    world.free();
  });

  it('is not held by the piece being placed', () => {
    const world = createTowerWorld();
    world.setStar(0, 4, 0.35);
    world.spawn(box(1, 1), 0, 4);
    run(world, 0.2);
    expect(world.starHeld()).toBe(false);
    world.free();
  });
});

describe('pigeon', () => {
  it('lands on the outer edge of the top piece and knocks a plank on a pillar off balance', () => {
    const world = createTowerWorld();
    place(world, box(0.4, 1), 0);
    const plank = place(world, box(3.4, 0.3), 0).id as number;
    const angle = () => world.bodies().find((b) => b.id === plank)?.angle ?? 0;
    expect(Math.abs(angle())).toBeLessThan(0.02);
    world.landPigeon(1);
    expect(world.pigeon()?.x).toBeGreaterThan(1.2);
    run(world, 3);
    // Knocked off balance (it may rock back once the pigeon slides off), or off the tower.
    expect(
      world.bodies().find((b) => b.id === plank) === undefined || Math.abs(angle()) > 0.1,
    ).toBe(true);
    world.free();
  });

  it('stays on a piece placed just before it landed', () => {
    const world = createTowerWorld();
    const id = world.spawn(box(3, 1), 0, 2);
    world.drop();
    run(world, 1);
    expect(world.bodies()[0]?.id).toBe(id);
    world.landPigeon(1);
    const left = run(world, 2);
    expect(left.fumbled).toEqual([]);
    expect(world.pigeon()).not.toBeNull();
    world.free();
  });

  it("doesn't count for the height, and settled pieces don't scare it", () => {
    const world = createTowerWorld();
    place(world, box(3, 1), 0);
    const before = world.height();
    world.landPigeon(-1);
    const { fumbled } = run(world, 2);
    expect(fumbled).toEqual([]);
    expect(world.pigeon()).not.toBeNull();
    expect(world.height()).toBeCloseTo(before, 2);
    expect(world.frame(false).slice(0, 1)).toEqual([PIGEON_ID]);
    world.free();
  });

  it('flies off when a new piece lands on it', () => {
    const world = createTowerWorld();
    place(world, box(3, 1), 0);
    world.landPigeon(1);
    run(world, 1);
    const at = world.pigeon();
    world.spawn(box(1, 1), at?.x ?? 0, 3);
    world.steer({ fast: true });
    let left: StepEvents['pigeon'] = null;
    for (let i = 0; i < 300 && left === null; i++) left = world.step().pigeon;
    expect(left).toBe('scared');
    expect(world.pigeon()).toBeNull();
    world.free();
  });

  it('tips a plank off the edge, and says so when it falls with it', () => {
    const world = createTowerWorld();
    // A plank just balanced past the platform's edge (3): its middle is 0.15 inside.
    const { id: plank } = place(world, box(3, 0.3), 2.85);
    expect(world.bodies().some((b) => b.id === plank)).toBe(true);
    world.landPigeon(1);
    let left: StepEvents['pigeon'] = null;
    const fumbled: number[] = [];
    for (let i = 0; i < 600 && left === null; i++) {
      const events = world.step();
      left = events.pigeon;
      fumbled.push(...events.fumbled);
    }
    expect(left).toBe('fell');
    // The plank it tipped over goes too.
    fumbled.push(...run(world, 3).fumbled);
    expect(fumbled).toEqual([plank]);
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
