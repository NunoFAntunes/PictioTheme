import { describe, expect, it } from 'vitest';
import { createTroupe, type Target, type TroupeFrame } from './troupe';

const target = (
  playerId: string,
  anchor: string,
  x: number,
  y: number,
  more: Partial<Target> = {},
): Target => ({
  playerId,
  team: 'orange',
  anchor,
  slot: 0,
  stand: { x, y, size: 40 },
  cloud: false,
  asleep: false,
  // Still while waiting, so positions can be checked exactly; the bob has its own test.
  calm: true,
  ...more,
});

/** Runs the troupe frame by frame (60 a second) from `from` to `to` ms, collecting every cue. */
function run(
  troupe: ReturnType<typeof createTroupe>,
  targets: () => Target[],
  from: number,
  to: number,
): { last: TroupeFrame; frames: TroupeFrame[] } {
  const frames: TroupeFrame[] = [];
  for (let t = from; t <= to; t += 1000 / 60) frames.push(troupe.update(targets(), t));
  const last = frames.at(-1);
  if (!last) throw new Error('no frames');
  return { last, frames };
}

const cuesOf = (frames: TroupeFrame[]) => frames.flatMap((f) => f.cues.map((c) => c.kind));
const pose = (frame: TroupeFrame, id: string) => frame.poses.find((p) => p.playerId === id);

describe('the troupe', () => {
  it('pops a newcomer in where they stand, without a sound', () => {
    const troupe = createTroupe();
    const first = troupe.update([target('ana', 'rim:orange', 100, 50)], 0);
    expect(pose(first, 'ana')).toMatchObject({ x: 100, y: 50, alpha: 0 });
    const { last, frames } = run(troupe, () => [target('ana', 'rim:orange', 100, 50)], 16, 400);
    expect(pose(last, 'ana')?.alpha).toBe(1);
    expect(cuesOf(frames)).toEqual([]);
  });

  it('flies someone to their new place on an arc: a hop, then a landing', () => {
    const troupe = createTroupe();
    troupe.update([target('ana', 'rim:orange', 100, 300)], 0);
    run(troupe, () => [target('ana', 'rim:orange', 100, 300)], 16, 500);
    const { frames, last } = run(troupe, () => [target('ana', 'pad:orange', 500, 300)], 520, 2200);
    expect(cuesOf(frames)).toEqual(['hop', 'land']);
    // Up in the air along the way, then on the spot.
    const highest = Math.min(...frames.map((f) => pose(f, 'ana')?.y ?? Infinity));
    expect(highest).toBeLessThan(300 - 40);
    expect(pose(last, 'ana')).toMatchObject({ x: 500, y: 300 });
    expect(frames.some((f) => f.effects.some((e) => e.kind === 'dust'))).toBe(true);
  });

  it('carries on to a newer place mid-flight without hopping again', () => {
    const troupe = createTroupe();
    troupe.update([target('ana', 'rim:orange', 0, 300)], 0);
    run(troupe, () => [target('ana', 'rim:orange', 0, 300)], 16, 400);
    const a = run(troupe, () => [target('ana', 'deciding:ana', 400, 300)], 420, 700);
    const b = run(
      troupe,
      () => [target('ana', 'cloud:orange', 800, 100, { cloud: true })],
      716,
      2500,
    );
    expect(cuesOf([...a.frames, ...b.frames])).toEqual(['hop', 'land']);
    expect(b.frames.at(-1)?.cues.at(-1)).toBeUndefined();
    expect(pose(b.last, 'ana')).toMatchObject({ x: 800, y: 100 });
    expect(b.last.clouds).toEqual([expect.objectContaining({ x: 800, alpha: 1 })]);
  });

  it('takes off a crowd a beat apart, and bonks two who meet in the air', () => {
    const troupe = createTroupe();
    const before = () => [
      target('ana', 'rim:orange', 0, 300),
      target('bo', 'pad:orange', 600, 300),
    ];
    troupe.update(before(), 0);
    run(troupe, before, 16, 400);
    // They swap places, so their paths cross.
    const after = () => [target('ana', 'pad:orange', 600, 300), target('bo', 'rim:orange', 0, 300)];
    const { frames } = run(troupe, after, 416, 2600);
    const hops = frames.flatMap((f, i) => f.cues.filter((c) => c.kind === 'hop').map(() => i));
    expect(hops).toHaveLength(2);
    expect((hops[1] ?? 0) - (hops[0] ?? 0)).toBeGreaterThan(2);
    expect(cuesOf(frames).filter((k) => k === 'bonk')).toHaveLength(1);
    expect(frames.some((f) => f.effects.some((e) => e.kind === 'stars'))).toBe(true);
    expect(cuesOf(frames).filter((k) => k === 'land')).toHaveLength(2);
  });

  it('just hops along a ledge to a new slot', () => {
    const troupe = createTroupe();
    troupe.update([target('ana', 'rim:orange', 100, 50)], 0);
    run(troupe, () => [target('ana', 'rim:orange', 100, 50)], 16, 400);
    const { frames } = run(
      troupe,
      () => [target('ana', 'rim:orange', 150, 50, { slot: 1 })],
      416,
      1200,
    );
    expect(cuesOf(frames)).toEqual(['hop', 'land']);
    expect(Math.min(...frames.map((f) => pose(f, 'ana')?.y ?? 0))).toBeGreaterThan(50 - 25);
    expect(frames.some((f) => f.effects.length > 0)).toBe(false);
  });

  it('follows a moving anchor without hopping (a cloud following its piece)', () => {
    const troupe = createTroupe();
    let x = 100;
    troupe.update([target('ana', 'cloud:orange', x, 50, { cloud: true })], 0);
    const { frames, last } = run(
      troupe,
      () => [target('ana', 'cloud:orange', (x += 3), 50, { cloud: true })],
      16,
      600,
    );
    expect(cuesOf(frames)).toEqual([]);
    expect(pose(last, 'ana')?.x).toBe(x);
  });

  it('keeps the calm still, and lets everyone else bob', () => {
    const troupe = createTroupe();
    const targets = () => [
      target('ana', 'cloud:orange', 100, 50, { cloud: true, calm: true }),
      target('bo', 'rim:orange', 300, 50, { calm: false }),
    ];
    const { frames } = run(troupe, targets, 0, 3000);
    const ys = (id: string) => new Set(frames.slice(30).map((f) => pose(f, id)?.y));
    expect(ys('ana')).toEqual(new Set([50]));
    expect(ys('bo').size).toBeGreaterThan(1);
  });

  it('pops back in where they were after being hidden, or flies from there if they moved', () => {
    const troupe = createTroupe();
    const two = () => [
      target('ana', 'rim:orange', 0, 300),
      target('bo', 'rim:orange', 100, 300, { slot: 1 }),
    ];
    troupe.update(two(), 0);
    run(troupe, two, 16, 400);
    run(troupe, () => [], 416, 900);
    const { frames, last } = run(
      troupe,
      () => [target('ana', 'rim:orange', 0, 300), target('bo', 'pad:orange', 600, 300)],
      916,
      2800,
    );
    expect(frames.flatMap((f) => f.cues).map((c) => c.kind)).toEqual(['hop', 'land']);
    expect(pose(frames[0] as TroupeFrame, 'ana')).toMatchObject({ x: 0, alpha: 0 });
    expect(pose(last, 'bo')).toMatchObject({ x: 600 });
  });

  it('leaves a cloud behind to fade when a placer flies off it', () => {
    const troupe = createTroupe();
    troupe.update([target('ana', 'cloud:orange', 100, 50, { cloud: true })], 0);
    run(troupe, () => [target('ana', 'cloud:orange', 100, 50, { cloud: true })], 16, 400);
    const { frames } = run(troupe, () => [target('ana', 'rim:orange', 500, 400)], 416, 1000);
    expect(frames[1]?.clouds[0]).toMatchObject({ x: 100 });
    expect(frames.at(-1)?.clouds).toEqual([]);
  });

  it('with reduced motion, moves people straight there, silently', () => {
    const troupe = createTroupe({ still: true });
    troupe.update([target('ana', 'rim:orange', 0, 300)], 0);
    const { frames } = run(troupe, () => [target('ana', 'pad:orange', 600, 300)], 16, 100);
    expect(pose(frames[0] as TroupeFrame, 'ana')).toMatchObject({ x: 600, alpha: 1 });
    expect(cuesOf(frames)).toEqual([]);
  });
});
