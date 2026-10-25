import { describe, expect, it } from 'vitest';
import type { Act } from './acts';
import { createShow, type ShowFrame, type Spot, type SpotKey } from './show';
import type { Pose } from './troupe';

const pose = (playerId: string, x: number, y: number, team: Pose['team'] = 'orange'): Pose => ({
  playerId,
  team,
  x,
  y,
  size: 40,
  angle: 0,
  scaleX: 1,
  scaleY: 1,
  alpha: 1,
  asleep: false,
  flying: false,
});

const SPOTS: Partial<Record<SpotKey, Spot>> = {
  'tower:teal': { x: 1000, y: 300, size: 30 },
  'tower:orange': { x: 100, y: 300, size: 30 },
  'rim:teal': { x: 1000, y: 100, size: 26 },
  'rim:orange': { x: 500, y: 100, size: 40 },
  'board:orange': { x: 600, y: 400, size: 52 },
  'slots:orange': { x: 80, y: 20, size: 28 },
};
const spot = (key: SpotKey) => SPOTS[key] ?? null;

const throwFog: Act = {
  kind: 'throw',
  what: 'spell',
  by: 'ana',
  team: 'orange',
  target: 'teal',
  icon: '🌫️',
  color: '#dfe7f2',
  landInMs: 1000,
};

/** Runs the show at 60 frames a second from `from` to `to` ms. */
function run(
  show: ReturnType<typeof createShow>,
  poses: Pose[],
  from: number,
  to: number,
  calm: string | null = null,
) {
  const frames: ShowFrame[] = [];
  for (let now = from; now <= to; now += 1000 / 60)
    frames.push(show.frame({ now, poses, spot, shivering: new Set(), calm }));
  return frames;
}

describe('the show', () => {
  it('winds the caster up, flies the orb to the tower, and bursts it as the spell starts', () => {
    const show = createShow();
    const ana = pose('ana', 500, 100);
    show.add([throwFog], 0);
    const frames = run(show, [ana], 0, 1300);
    // Leaning back, away from the target, before letting go.
    expect(frames[10]?.poses[0]?.angle).toBeLessThan(-0.1);
    expect(frames[10]?.orbs).toEqual([]);
    // In the air, then gone at about 1s, with a burst there.
    const flying = frames.filter((f) => f.orbs.length > 0);
    expect(flying.length).toBeGreaterThan(30);
    expect(flying[0]?.orbs[0]?.x).toBeLessThan(600);
    const burstAt = frames.findIndex((f) => f.cues.length > 0);
    expect(burstAt * (1000 / 60)).toBeCloseTo(1000, -2);
    expect(frames[burstAt]?.cues).toEqual([{ kind: 'burst', team: 'teal', x: 1000 }]);
    expect(frames[burstAt]?.particles.length).toBeGreaterThan(10);
    expect(show.busy()).toBe(true);
    run(show, [ana], 1300, 2500);
    expect(show.busy()).toBe(false);
  });

  it('throws from the crew’s rim when the thrower isn’t on screen, and drops a throw with no target', () => {
    const show = createShow();
    show.add([throwFog], 0);
    const first = run(show, [], 0, 600).find((f) => f.orbs.length > 0);
    expect(first?.orbs[0]?.x).toBeCloseTo(500, -1);

    const lost = createShow();
    lost.add([throwFog], 0);
    let orbs = 0;
    for (let now = 0; now < 600; now += 16)
      orbs += lost.frame({ now, poses: [], spot: () => null, shivering: new Set(), calm: null })
        .orbs.length;
    expect(orbs).toBe(0);
    expect(lost.busy()).toBe(false);
  });

  it('keeps you still while you place, even when you cast', () => {
    const show = createShow();
    show.add([throwFog], 0);
    const frames = run(show, [pose('ana', 500, 100)], 0, 600, 'ana');
    expect(new Set(frames.map((f) => f.poses[0]?.angle))).toEqual(new Set([0]));
    expect(frames.at(-1)?.orbs).toHaveLength(1);
  });

  it('dashes a masked thief to the other crew’s drawing and back with it', () => {
    const show = createShow();
    show.add([{ kind: 'steal', by: 'ana', team: 'orange', robbed: 'teal' }], 0);
    const frames = run(show, [pose('ana', 500, 100)], 0, 1700);
    const xs = frames.map((f) => f.poses[0]?.x ?? 0);
    expect(Math.max(...xs)).toBeCloseTo(1000, 0);
    expect(xs.at(-1)).toBe(500);
    expect(frames[5]?.props.map((p) => p.kind)).toEqual(['mask']);
    expect(frames[40]?.props.map((p) => p.kind)).toEqual(['mask', 'paper']);
    expect(frames.flatMap((f) => f.cues).map((c) => c.kind)).toEqual(['swish', 'swish']);
    expect(frames.at(-1)?.props).toEqual([]);
  });

  it('flies a golden word’s spell from the drawing into the slots, and the crew glows', () => {
    const show = createShow();
    show.add([{ kind: 'gained', team: 'orange', spell: 'fog', icon: '🌫️', reason: 'golden' }], 0);
    const poses = [pose('ana', 500, 100), pose('ed', 900, 100, 'teal')];
    const frames = run(show, poses, 0, 1000);
    expect(frames[0]?.orbs[0]).toMatchObject({ x: 600, y: 400 });
    expect(frames[0]?.particles.length).toBeGreaterThan(15);
    expect(frames[30]?.halos.get('ana')).toBeGreaterThan(0.5);
    expect(frames[30]?.halos.has('ed')).toBe(false);
    const landed = frames.find((f) => f.cues.length > 0);
    expect(landed?.cues).toEqual([{ kind: 'burst', team: 'orange', x: 80 }]);
  });

  it('shivers a drawer under Shaky hand', () => {
    const show = createShow();
    const ed = pose('ed', 900, 100, 'teal');
    const xs = new Set<number>();
    for (let now = 0; now < 500; now += 16)
      xs.add(
        show.frame({ now, poses: [ed], spot, shivering: new Set(['ed']), calm: null }).poses[0]
          ?.x ?? 0,
      );
    expect(xs.size).toBeGreaterThan(5);
    for (const x of xs) expect(Math.abs(x - 900)).toBeLessThanOrEqual(2.2);
  });

  it('acts out nothing with reduced motion', () => {
    const show = createShow({ still: true });
    show.add([throwFog, { kind: 'steal', by: 'ana', team: 'orange', robbed: 'teal' }], 0);
    const ed = pose('ed', 900, 100, 'teal');
    const frames = run(show, [pose('ana', 500, 100), ed], 0, 1500);
    expect(
      frames.every((f) => f.orbs.length === 0 && f.props.length === 0 && f.cues.length === 0),
    ).toBe(true);
    const shaken = show.frame({
      now: 50,
      poses: [ed],
      spot,
      shivering: new Set(['ed']),
      calm: null,
    });
    expect(shaken.poses[0]?.x).toBe(900);
  });
});
