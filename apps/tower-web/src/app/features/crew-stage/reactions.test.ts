import type { Team } from '@pictiotheme/protocol/tower';
import { describe, expect, it } from 'vitest';
import { createReactions, type ReactionFrame, type ReactionScene } from './reactions';
import type { Spot, SpotKey } from './show';
import type { Pose } from './troupe';

const pose = (playerId: string, team: Team, x: number, more: Partial<Pose> = {}): Pose => ({
  playerId,
  team,
  x,
  y: 100,
  size: 40,
  angle: 0,
  scaleX: 1,
  scaleY: 1,
  alpha: 1,
  asleep: false,
  flying: false,
  ...more,
});

const SPOTS: Partial<Record<SpotKey, Spot>> = { 'tower:orange': { x: 300, y: 500, size: 40 } };

const POSES = [pose('ana', 'orange', 100), pose('bo', 'orange', 200), pose('ed', 'teal', 900)];

function run(
  reactions: ReturnType<typeof createReactions>,
  from: number,
  to: number,
  scene: Partial<ReactionScene> = {},
): ReactionFrame[] {
  const frames: ReactionFrame[] = [];
  for (let now = from; now <= to; now += 1000 / 60) {
    frames.push(
      reactions.frame({
        now,
        poses: POSES,
        spot: (key) => SPOTS[key] ?? null,
        dazed: new Set(),
        topping: new Set(),
        calm: null,
        ...scene,
      }),
    );
  }
  return frames;
}

const ys = (frames: ReactionFrame[], id: string) =>
  frames.map((f) => f.poses.find((p) => p.playerId === id)?.y ?? 0);

describe('reactions', () => {
  it('hops a crew whose drawing was guessed, one after the other, and leaves the other crew be', () => {
    const reactions = createReactions();
    reactions.add([{ kind: 'cheer', team: 'orange' }], 0);
    const frames = run(reactions, 0, 900);
    const ana = ys(frames, 'ana');
    const bo = ys(frames, 'bo');
    expect(Math.min(...ana)).toBeLessThan(100 - 10);
    // Bo's hop starts a beat after Ana's.
    expect(ana.findIndex((y) => y < 99)).toBeLessThan(bo.findIndex((y) => y < 99));
    expect(new Set(ys(frames, 'ed'))).toEqual(new Set([100]));
    expect(ana.at(-1)).toBe(100);
    expect(reactions.busy()).toBe(false);
  });

  it('startles a robbed crew with a "!" over their heads', () => {
    const reactions = createReactions();
    reactions.add([{ kind: 'startle', team: 'teal' }], 0);
    const frames = run(reactions, 0, 1000);
    expect(frames[5]?.marks).toEqual([expect.objectContaining({ kind: 'bang', x: 914 })]);
    expect(Math.min(...ys(frames, 'ed'))).toBeLessThan(95);
    expect(frames.at(-1)?.marks).toEqual([]);
  });

  it('rains on the tower of a crew that lost a piece, for a while', () => {
    const reactions = createReactions();
    reactions.add([{ kind: 'rain', team: 'orange' }], 0);
    const frames = run(reactions, 0, 2700);
    expect(frames[30]?.rain).toEqual([
      expect.objectContaining({ x: 300, y: 500 - 140 * 0.55, width: 140, alpha: 1 }),
    ]);
    expect(frames.at(-1)?.rain).toEqual([]);
  });

  it('sways a dazed crew with stars round their heads, and bounces a crew topping out', () => {
    const reactions = createReactions();
    const frames = run(reactions, 0, 1000, {
      dazed: new Set(['orange']),
      topping: new Set(['teal']),
    });
    expect(frames[10]?.marks.map((m) => m.kind)).toEqual(['dizzy', 'dizzy']);
    expect(new Set(frames.map((f) => f.poses[0]?.angle)).size).toBeGreaterThan(10);
    expect(Math.min(...ys(frames, 'ed'))).toBeLessThan(95);
  });

  it('leaves you be while you place, and the asleep, and does nothing with reduced motion', () => {
    const reactions = createReactions();
    reactions.add([{ kind: 'cheer', team: 'orange' }], 0);
    const frames = run(reactions, 0, 900, { calm: 'ana', dazed: new Set(['orange']) });
    expect(new Set(ys(frames, 'ana'))).toEqual(new Set([100]));
    expect(frames[10]?.marks).toHaveLength(1);

    const still = createReactions({ still: true });
    still.add([{ kind: 'cheer', team: 'orange' }], 0);
    const quiet = run(still, 0, 900, { dazed: new Set(['orange']) });
    expect(quiet.every((f) => f.marks.length === 0 && f.rain.length === 0)).toBe(true);
    expect(new Set(ys(quiet, 'ana'))).toEqual(new Set([100]));
  });
});
