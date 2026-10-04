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
    expect(pixel(data, 2, 2)).toEqual([0, 0, 0, 255]); // the wall
    expect(pixel(data, 3, 0)).toEqual([0, 0, 0, 0]); // the other side
  });

  it('is deterministic', () => {
    const a = imageWithWall();
    const b = imageWithWall();
    floodFill(a, 5, 5, 4, 4, [0, 128, 0, 255], 10);
    floodFill(b, 5, 5, 4, 4, [0, 128, 0, 255], 10);
    expect(a).toEqual(b);
  });

  it('respects tolerance', () => {
    const data = new Uint8ClampedArray(5 * 5 * 4).fill(0);
    data.set([20, 20, 20, 255], (0 * 5 + 1) * 4); // opaque dark pixel next to transparent ones
    floodFill(data, 5, 5, 0, 0, [255, 255, 255, 255], 30);
    expect(pixel(data, 1, 0)).toEqual([20, 20, 20, 255]); // alpha 255 vs 0 is outside tolerance
    expect(pixel(data, 4, 4)).toEqual([255, 255, 255, 255]);
  });

  it('parses hex colours', () => {
    expect(hexToRgba('#ff8000')).toEqual([255, 128, 0, 255]);
  });
});
