import { describe, expect, it } from 'vitest';
import { findClosedShape } from './closed-shape';

const W = 200;
const H = 200;

type Box = [x0: number, y0: number, x1: number, y1: number];

function blank(): Uint8ClampedArray {
  return new Uint8ClampedArray(W * H * 4);
}

/** A 2-px ink outline of a box; `gap` leaves a hole in its top edge. */
function outline(data: Uint8ClampedArray, [x0, y0, x1, y1]: Box, gap = false): Uint8ClampedArray {
  const ink = (x: number, y: number) => data.set([27, 36, 51, 255], (y * W + x) * 4);
  for (let x = x0; x <= x1; x++) {
    for (const y of [y0, y0 + 1, y1 - 1, y1]) {
      if (!(gap && y <= y0 + 1 && x > (x0 + x1) / 2 - 4 && x < (x0 + x1) / 2 + 4)) ink(x, y);
    }
  }
  for (let y = y0; y <= y1; y++) for (const x of [x0, x0 + 1, x1 - 1, x1]) ink(x, y);
  return data;
}

const bounds = ([minX, minY, maxX, maxY]: Box) => ({ minX, minY, maxX, maxY });
const find = (before: Uint8ClampedArray, after: Uint8ClampedArray, stroke: Box) =>
  findClosedShape(before, after, W, H, bounds(stroke), 0);

describe('findClosedShape', () => {
  it('finds the shape a stroke closes, with a seed inside it', () => {
    const box: Box = [40, 40, 160, 140];
    const shape = find(blank(), outline(blank(), box), box);
    expect(shape?.centre).toEqual({ x: 100, y: 90 });
    expect(shape?.seed.x).toBeGreaterThan(41);
    expect(shape?.seed.x).toBeLessThan(159);
  });

  it('ignores a shape with a gap', () => {
    const box: Box = [40, 40, 160, 140];
    expect(find(blank(), outline(blank(), box, true), box)).toBeNull();
  });

  it('ignores a loop too small to colour', () => {
    const box: Box = [90, 90, 110, 110];
    expect(find(blank(), outline(blank(), box), box)).toBeNull();
  });

  it('ignores a squiggle inside a shape that was already closed', () => {
    const house = outline(blank(), [20, 20, 180, 180]);
    const after = house.slice();
    for (let x = 80; x < 120; x++) after.set([27, 36, 51, 255], (100 * W + x) * 4);
    expect(find(house, after, [80, 80, 120, 120])).toBeNull();
  });

  it('finds a window drawn inside a house', () => {
    const house = outline(blank(), [20, 20, 180, 180]);
    const window: Box = [60, 60, 120, 110];
    const shape = find(house, outline(house.slice(), window), window);
    expect(shape?.centre).toEqual({ x: 90, y: 85 });
  });
});
