import { describe, expect, it } from 'vitest';
import { floodFill, hexToRgba } from './flood-fill';

/** A 5×5 transparent image with a black vertical wall at x = 2. */
function imageWithWall(): Uint8ClampedArray {
  const data = new Uint8ClampedArray(5 * 5 * 4);
  for (let y = 0; y < 5; y++) data.set([0, 0, 0, 255], (y * 5 + 2) * 4);
  return data;
}

function pixel(data: Uint8ClampedArray, x: number, y: number): number[] {
  const i = (y * 5 + x) * 4;
  return [...data.slice(i, i + 4)];
}

describe('floodFill', () => {
  it('fills the connected region and stops at walls', () => {
    const data = imageWithWall();
    floodFill(data, 5, 5, 0, 0, [255, 0, 0, 255], 0);
    expect(pixel(data, 1, 4)).toEqual([255, 0, 0, 255]);
    expect(pixel(data, 3, 0)).toEqual([0, 0, 0, 0]); // the other side
  });

  it('grows 1 px into the edge so no ring is left', () => {
    // A 2-px wall at x = 2..3: an anti-aliased edge pixel at x = 2, solid ink at x = 3.
    const data = new Uint8ClampedArray(5 * 5 * 4);
    for (let y = 0; y < 5; y++) {
      data.set([0, 0, 0, 128], (y * 5 + 2) * 4);
      data.set([0, 0, 0, 255], (y * 5 + 3) * 4);
    }
    floodFill(data, 5, 5, 0, 0, [255, 0, 0, 255], 0);
    expect(pixel(data, 2, 2)).toEqual([255, 0, 0, 255]); // the edge pixel is covered
    expect(pixel(data, 3, 2)).toEqual([0, 0, 0, 255]); // but only 1 px of it
    expect(pixel(data, 4, 2)).toEqual([0, 0, 0, 0]); // and the fill doesn't leak past
  });

  it('is deterministic', () => {
    const a = imageWithWall();
    const b = imageWithWall();
    floodFill(a, 5, 5, 4, 4, [0, 128, 0, 255], 10);
    floodFill(b, 5, 5, 4, 4, [0, 128, 0, 255], 10);
    expect(a).toEqual(b);
  });

  it('respects tolerance', () => {
    // Transparent left half; a 2-px opaque dark wall at x = 2..3 (2 px, so the 1-px grow can't hide it).
    const data = new Uint8ClampedArray(5 * 5 * 4).fill(0);
    for (let y = 0; y < 5; y++) {
      data.set([10, 10, 10, 10], (y * 5 + 1) * 4); // within tolerance of transparent
      data.set([20, 20, 20, 255], (y * 5 + 2) * 4);
      data.set([20, 20, 20, 255], (y * 5 + 3) * 4);
    }
    floodFill(data, 5, 5, 0, 0, [255, 255, 255, 255], 30);
    expect(pixel(data, 1, 4)).toEqual([255, 255, 255, 255]); // inside tolerance: filled
    expect(pixel(data, 3, 2)).toEqual([20, 20, 20, 255]); // alpha 255 vs 0 is outside tolerance
    expect(pixel(data, 4, 2)).toEqual([0, 0, 0, 0]);
  });

  it('parses hex colours', () => {
    expect(hexToRgba('#ff8000')).toEqual([255, 128, 0, 255]);
  });
});
