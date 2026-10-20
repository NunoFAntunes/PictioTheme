import { enclosedRegion, type Region } from '@pictiotheme/canvas-engine';

/**
 * Did the stroke just drawn close a shape? Pure, on the canvas's pixels before and after it.
 *
 * Blank points across the stroke's bounds (nearest its middle first) are tried as fill seeds.
 * A shape counts when a fill there would stay inside it, it's big enough to be worth colouring,
 * and it's new: the area was open before the stroke, or the stroke cut it well down (a window
 * drawn inside a house). A squiggle inside a shape that's already closed doesn't count.
 */

export type ClosedShape = {
  /** Where a fill colours it in, in logical px. */
  seed: { x: number; y: number };
  /** The middle of its bounds, for the swatch. */
  centre: { x: number; y: number };
};

export type Bounds = { minX: number; minY: number; maxX: number; maxY: number };

/** Smaller loops (an eye, where lines cross) are left to the bucket, in logical px². */
export const MIN_SHAPE_AREA = 400;
/** Seeds tried per side of the stroke's bounds. */
const GRID = 7;
/** A shape that was already closed counts if the stroke left at most this much of it. */
const CUT_SHARE = 0.8;

export function findClosedShape(
  before: Uint8ClampedArray,
  after: Uint8ClampedArray,
  width: number,
  height: number,
  stroke: Bounds,
  tolerance: number,
): ClosedShape | null {
  if (stroke.maxX - stroke.minX < 20 || stroke.maxY - stroke.minY < 20) return null;
  const midX = (stroke.minX + stroke.maxX) / 2;
  const midY = (stroke.minY + stroke.maxY) / 2;
  const seeds: { x: number; y: number }[] = [];
  for (let i = 1; i <= GRID; i++) {
    for (let j = 1; j <= GRID; j++) {
      seeds.push({
        x: Math.round(stroke.minX + ((stroke.maxX - stroke.minX) * i) / (GRID + 1)),
        y: Math.round(stroke.minY + ((stroke.maxY - stroke.minY) * j) / (GRID + 1)),
      });
    }
  }
  seeds.sort((a, b) => Math.hypot(a.x - midX, a.y - midY) - Math.hypot(b.x - midX, b.y - midY));

  // Shapes already looked at and turned down, so their other seeds are skipped.
  const rejected: Region[] = [];
  for (const seed of seeds) {
    const pixel = seed.y * width + seed.x;
    if ((after[pixel * 4 + 3] ?? 0) !== 0 || (before[pixel * 4 + 3] ?? 0) !== 0) continue;
    if (rejected.some((r) => r.visited[pixel])) continue;
    const region = enclosedRegion(after, width, height, seed.x, seed.y, tolerance);
    if (!region) continue;
    const was = enclosedRegion(before, width, height, seed.x, seed.y, tolerance);
    if (region.size < MIN_SHAPE_AREA || (was && region.size > was.size * CUT_SHARE)) {
      rejected.push(region);
      continue;
    }
    return {
      seed,
      centre: {
        x: Math.round((region.minX + region.maxX) / 2),
        y: Math.round((region.minY + region.maxY) / 2),
      },
    };
  }
  return null;
}
