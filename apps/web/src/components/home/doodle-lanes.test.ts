import { describe, expect, it } from 'vitest';
import { MIN_COPY_WIDTH, layOutLanes } from './doodle-lanes';
import { DOODLES } from './doodles';

const knownIds = new Set(Object.values(DOODLES).flatMap((set) => set.map((d) => d.id)));

describe('layOutLanes', () => {
  it('lays out the same picture on every render', () => {
    expect(layOutLanes()).toEqual(layOutLanes());
  });

  it('makes every copy of a lane wider than the widest screen, so the loop never shows a gap', () => {
    for (const lane of layOutLanes()) {
      const width = lane.doodles.reduce((sum, d) => sum + d.size + d.gapBefore, 0);
      expect(width).toBeGreaterThanOrEqual(MIN_COPY_WIDTH);
    }
  });

  it('only places doodles that exist, and alternates the direction of neighbouring lanes', () => {
    const lanes = layOutLanes();
    for (const lane of lanes) {
      for (const d of lane.doodles) expect(knownIds).toContain(d.id);
    }
    lanes.slice(1).forEach((lane, i) => expect(lane.reverse).not.toBe(lanes[i]?.reverse));
  });

  it('keeps doodle ids unique across themes, since they become SVG symbol ids', () => {
    const all = Object.values(DOODLES).flatMap((set) => set.map((d) => d.id));
    expect(new Set(all).size).toBe(all.length);
  });
});
