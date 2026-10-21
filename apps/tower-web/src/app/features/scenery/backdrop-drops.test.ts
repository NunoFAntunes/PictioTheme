import { describe, expect, it } from 'vitest';
import { addDrops, backdropLayout, createDropLife, stepDrops, type Drop } from './backdrop-drops';
import { createBackdropVillage, stepVillage, takeCues, type Cue } from './village';

const image = {} as HTMLCanvasElement;

describe('dropping things into the backdrop village', () => {
  it('falls from where it was on screen, lands on the lane, squashes, and is cleared away', () => {
    const { feet, unitPx, halfSpan } = backdropLayout(1280, 720);
    const v = createBackdropVillage(7, halfSpan, 0);
    for (let i = 0; i < 20; i++) stepVillage(v, 0.1);
    // Right over the hammerer.
    const under = v.villagers.find((x) => x.job.kind === 'hammer');
    if (!under) throw new Error('no hammerer');
    const px = 640 + under.x * unitPx;
    const drop: Drop = { image, rect: { x: px - 130, y: 400, width: 260, height: 80 } };
    const life = createDropLife();
    const toWorld = (x: number, y: number) => ({ x: (x - 640) / unitPx, y: (feet - y) / unitPx });
    addDrops(life, [drop], unitPx, toWorld, () => 0.5);
    expect(life.busy).toBe(true);
    expect(life.fallers[0]?.w).toBeCloseTo(260 / unitPx);

    const cues: Cue[] = [];
    let cleared = false;
    let landedAt = -1;
    for (let t = 0; t < 30 && !cleared; t += 1 / 30) {
      cleared = stepDrops(life, v, 1 / 30);
      if (landedAt < 0 && v.rubble.length) landedAt = t;
      stepVillage(v, 1 / 30);
      cues.push(...takeCues(v));
    }
    // About a second's fall from y = 440 px to the lane.
    expect(landedAt).toBeGreaterThan(0.5);
    expect(landedAt).toBeLessThan(1.5);
    expect(cues[0]).toMatchObject({ kind: 'thump' });
    expect(cues.some((c) => c.kind === 'squish')).toBe(true);
    expect(cues.some((c) => c.kind === 'whack')).toBe(true);
    expect(cleared).toBe(true);
    expect(life.busy).toBe(false);
    expect(life.fallen.size).toBe(0);
  });

  it('lands at once with reduced motion', () => {
    const { halfSpan, unitPx } = backdropLayout(1280, 720);
    const v = createBackdropVillage(7, halfSpan, 0);
    const life = createDropLife();
    addDrops(
      life,
      [{ image, rect: { x: 0, y: 0, width: 100, height: 50 } }],
      unitPx,
      () => ({ x: 0, y: 6 }),
      () => 0.5,
    );
    stepDrops(life, v, 0, true);
    expect(life.fallers).toHaveLength(0);
    expect(v.rubble).toHaveLength(1);
  });
});
