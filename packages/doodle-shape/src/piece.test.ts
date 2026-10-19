import type { Stroke } from '@pictiotheme/protocol';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SHAPE_CONFIG, makePiece, type FlatPolygon, type Piece } from './piece';
import { SAMPLE_DRAWINGS } from './samples';

const sample = (word: string): Stroke[] => {
  const found = SAMPLE_DRAWINGS.find((s) => s.word === word);
  if (!found) throw new Error(`no sample ${word}`);
  return found.strokes;
};

function pieceOf(strokes: readonly Stroke[]): Piece {
  const result = makePiece(strokes);
  if (!result.ok) throw new Error('expected a piece');
  return result.piece;
}

const pairs = (flat: FlatPolygon): [number, number][] =>
  Array.from({ length: flat.length / 2 }, (_, i) => [
    flat[2 * i] as number,
    flat[2 * i + 1] as number,
  ]);

function area(flat: FlatPolygon): number {
  const pts = pairs(flat);
  let sum = 0;
  pts.forEach(([x, y], i) => {
    const [nx, ny] = pts[(i + 1) % pts.length] as [number, number];
    sum += x * ny - nx * y;
  });
  return sum / 2;
}

function isConvexCcw(flat: FlatPolygon): boolean {
  const pts = pairs(flat);
  return pts.every(([ax, ay], i) => {
    const [bx, by] = pts[(i + 1) % pts.length] as [number, number];
    const [cx, cy] = pts[(i + 2) % pts.length] as [number, number];
    return (bx - ax) * (cy - by) - (by - ay) * (cx - bx) >= -1e-9;
  });
}

function size(flat: FlatPolygon) {
  const pts = pairs(flat);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return { w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
}

/** The same strokes, scaled about a point and moved. */
function transform(strokes: readonly Stroke[], k: number, dx: number, dy: number): Stroke[] {
  return strokes.map((s) =>
    'pts' in s
      ? {
          ...s,
          size: Math.max(1, Math.round(s.size * k)),
          pts: s.pts.map((v, i) =>
            i % 3 === 2
              ? v
              : Math.round(i % 3 === 0 ? 600 + (v - 600) * k + dx : 450 + (v - 450) * k + dy),
          ),
        }
      : s,
  );
}

describe('makePiece: every sample', () => {
  for (const { word, strokes } of SAMPLE_DRAWINGS) {
    it(`${word}: a valid, normalized piece`, () => {
      const piece = pieceOf(strokes);
      const outline = pairs(piece.outline);
      expect(outline.length).toBeGreaterThanOrEqual(3);
      expect(outline.length).toBeLessThanOrEqual(DEFAULT_SHAPE_CONFIG.maxVertices);
      expect(piece.parts.length).toBeGreaterThanOrEqual(1);
      expect(piece.parts.length).toBeLessThanOrEqual(DEFAULT_SHAPE_CONFIG.maxParts);
      // Counter-clockwise outline, convex counter-clockwise parts that add up to the outline.
      expect(area(piece.outline)).toBeGreaterThan(0);
      for (const part of piece.parts) expect(isConvexCcw(part)).toBe(true);
      const partsArea = piece.parts.reduce((sum, p) => sum + area(p), 0);
      expect(partsArea).toBeCloseTo(piece.area, 4);
      // Normalized: never above the target, exactly on it unless the length cap kicked in.
      expect(piece.area).toBeLessThanOrEqual(DEFAULT_SHAPE_CONFIG.targetArea + 1e-9);
      if (piece.limitedBy === 'area')
        expect(piece.area).toBeCloseTo(DEFAULT_SHAPE_CONFIG.targetArea, 6);
      const { w, h } = size(piece.outline);
      expect(Math.hypot(w, h)).toBeLessThanOrEqual(
        DEFAULT_SHAPE_CONFIG.maxLength * Math.SQRT2 + 1e-6,
      );
      // Centred on its centroid.
      const [cx, cy] = pairs(piece.outline).reduce(([sx, sy], [x, y]) => [sx + x, sy + y], [0, 0]);
      expect(Math.abs(cx / outline.length)).toBeLessThan(1);
      expect(Math.abs(cy / outline.length)).toBeLessThan(1);
    });
  }
});

/** Ray casting: is (x, y) inside the flat polygon? */
function inside(flat: FlatPolygon, x: number, y: number): boolean {
  const pts = pairs(flat);
  let hit = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i] as [number, number];
    const [xj, yj] = pts[j] as [number, number];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

/** The smallest corner angle of a polygon, in degrees (convex corners only: spikes). */
function sharpestCorner(flat: FlatPolygon): number {
  const pts = pairs(flat);
  const ccw = area(flat) > 0;
  let min = 180;
  pts.forEach(([bx, by], i) => {
    const [ax, ay] = pts[(i + pts.length - 1) % pts.length] as [number, number];
    const [cx, cy] = pts[(i + 1) % pts.length] as [number, number];
    const cross = (bx - ax) * (cy - by) - (by - ay) * (cx - bx);
    if (ccw ? cross <= 0 : cross >= 0) return;
    const u = Math.atan2(ay - by, ax - bx);
    const v = Math.atan2(cy - by, cx - bx);
    let deg = (Math.abs(u - v) * 180) / Math.PI;
    if (deg > 180) deg = 360 - deg;
    min = Math.min(min, deg);
  });
  return min;
}

describe('makePiece: the piece matches the drawing', () => {
  for (const { word, strokes } of SAMPLE_DRAWINGS) {
    it(`${word}: the ink is inside the piece`, () => {
      const result = makePiece(strokes);
      if (!result.ok) throw new Error('expected a piece');
      const { silhouette, frame } = result.preview;
      const points = strokes.flatMap((s) =>
        'pts' in s ? pairs(s.pts.filter((_, i) => i % 3 !== 2)) : [],
      );
      // Every point of the strokes' centre lines, give or take a cell at the outline.
      const near = (x: number, y: number) =>
        [0, 1, -1].some((dx) =>
          [0, 1, -1].some((dy) => inside(silhouette, x + dx * frame.cell, y + dy * frame.cell)),
        );
      const missed = points.filter(([x, y]) => !near(x, y));
      expect(missed).toEqual([]);
    });
  }
});

describe('makePiece: shapes', () => {
  it('joins the dashes around a lightbulb as rays, without slivers', () => {
    const result = makePiece(sample('lightbulb'));
    if (!result.ok) throw new Error('expected a piece');
    expect(result.preview.cells.includes(2)).toBe(false);
    // The old pipeline cut each dash into a thin triangle from its tip back to the bulb.
    expect(sharpestCorner(result.preview.silhouette)).toBeGreaterThan(60);
  });

  it('fills a circle drawn with a small gap into one convex disc', () => {
    const piece = pieceOf(sample('ball'));
    expect(piece.parts).toHaveLength(1);
    const { w, h } = size(piece.outline);
    expect(w / h).toBeCloseTo(1, 1);
    const diameter = 2 * Math.sqrt(DEFAULT_SHAPE_CONFIG.targetArea / Math.PI);
    expect(w).toBeGreaterThan(diameter * 0.95);
    expect(w).toBeLessThan(diameter * 1.08);
  });

  it('turns a rectangle outline into a solid brick', () => {
    const piece = pieceOf(sample('brick'));
    expect(pairs(piece.outline)).toHaveLength(4);
    expect(piece.parts).toHaveLength(1);
    const { w, h } = size(piece.outline);
    expect(w / h).toBeCloseTo(2, 0);
  });

  it('keeps concave shapes concave, split into several convex parts', () => {
    expect(pieceOf(sample('boot')).parts.length).toBeGreaterThanOrEqual(2);
    expect(pieceOf(sample('cactus')).parts.length).toBeGreaterThanOrEqual(3);
    expect(pieceOf(sample('star')).parts.length).toBeGreaterThanOrEqual(3);
  });

  it('caps a long thin line at the maximum length', () => {
    const piece = pieceOf(sample('skateboard'));
    expect(piece.limitedBy).toBe('length');
    expect(size(piece.outline).w).toBeCloseTo(DEFAULT_SHAPE_CONFIG.maxLength, 1);
    expect(piece.area).toBeLessThan(DEFAULT_SHAPE_CONFIG.targetArea);
  });

  it('keeps a balloon string attached to the balloon', () => {
    const result = makePiece(sample('balloon'));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.preview.cells.includes(2)).toBe(false);
    expect(size(result.piece.outline).h).toBeGreaterThan(size(result.piece.outline).w * 1.8);
  });
});

describe('makePiece: normalization', () => {
  it('gives the same piece whatever size and place it was drawn at', () => {
    const big = pieceOf(sample('house'));
    const small = pieceOf(transform(sample('house'), 0.25, -300, 200));
    expect(small.area).toBeCloseTo(big.area, 6);
    const a = size(big.outline);
    const b = size(small.outline);
    expect(b.w).toBeCloseTo(a.w, 0);
    expect(b.h).toBeCloseTo(a.h, 0);
  });

  it('is deterministic', () => {
    expect(makePiece(sample('cactus'))).toEqual(makePiece(sample('cactus')));
  });

  it('records where the piece sits on the drawing', () => {
    const piece = pieceOf(sample('brick'));
    expect(piece.origin.x).toBeCloseTo(600, -1);
    expect(piece.origin.y).toBeCloseTo(450, -1);
    expect(piece.bounds.width).toBeGreaterThan(590);
    expect(piece.scale * piece.bounds.width).toBeCloseTo(size(piece.outline).w, 1);
  });
});

describe('makePiece: what gets dropped', () => {
  const blob = (x: number, y: number, r: number): Stroke => ({
    id: `b${x}`,
    tool: 'brush',
    color: '#000000',
    size: r * 2,
    opacity: 1,
    pts: [x, y, 0.5],
  });

  it('is blank with no strokes, or when everything was erased or cleared', () => {
    expect(makePiece([]).ok).toBe(false);
    expect(makePiece([...sample('ball'), { id: 'c', tool: 'clear' }]).ok).toBe(false);
    const erased: Stroke = {
      id: 'e',
      tool: 'eraser',
      color: '#000000',
      size: 64,
      opacity: 1,
      pts: [600, 450, 0.5],
    };
    expect(makePiece([blob(600, 450, 20), erased]).ok).toBe(false);
  });

  it('keeps the largest blob and drops far-away ones', () => {
    const result = makePiece([blob(300, 450, 60), blob(1000, 450, 20)]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.piece.origin.x).toBeCloseTo(300, -1);
    expect(result.preview.cells.includes(2)).toBe(true);
  });

  it('ignores ink drawn before a clear', () => {
    const result = makePiece([blob(200, 200, 40), { id: 'c', tool: 'clear' }, ...sample('brick')]);
    expect(result.ok && result.piece.origin.x).toBeCloseTo(600, -1);
  });
});
