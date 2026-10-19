import type { Grid } from './grid';

/** A polygon as `[x, y]` pairs, closed implicitly (the last vertex connects to the first). */
export type Point = [number, number];
export type Polygon = Point[];

/**
 * Step 5: the outline of the solid cells, in grid coordinates. The solid must be one 4-connected
 * region with no holes and no saddles (grid.ts makes sure), so every cell corner has at most one
 * outgoing edge and the edges form exactly one loop.
 *
 * The loop runs through the **midpoints** of the cell edges rather than their corners: a
 * staircase of cells then becomes a straight diagonal, so slanted edges don't turn into zigzags
 * (and into dozens of convex parts) when the outline is simplified.
 */
export function traceOutline(grid: Grid): Polygon {
  const { cols, rows, data } = grid;
  const solid = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < cols && y < rows && data[y * cols + x] === 1;
  const W = cols + 1;
  const next = new Map<number, number>();
  const key = (x: number, y: number) => y * W + x;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (!solid(x, y)) continue;
      // Clockwise around the cell on screen (y down); edges shared by two solid cells cancel out.
      if (!solid(x, y - 1)) next.set(key(x, y), key(x + 1, y));
      if (!solid(x + 1, y)) next.set(key(x + 1, y), key(x + 1, y + 1));
      if (!solid(x, y + 1)) next.set(key(x + 1, y + 1), key(x, y + 1));
      if (!solid(x - 1, y)) next.set(key(x, y + 1), key(x, y));
    }
  }
  const first = next.keys().next();
  if (first.done) return [];
  const loop: Point[] = [];
  let at = first.value;
  for (let guard = 0; guard <= next.size; guard++) {
    const x = at % W;
    loop.push([x, (at - x) / W]);
    const to = next.get(at);
    if (to === undefined || to === first.value) break;
    at = to;
  }
  const midpoints: Polygon = loop.map(([x, y], i) => {
    const [nx, ny] = loop[(i + 1) % loop.length] as Point;
    return [(x + nx) / 2, (y + ny) / 2];
  });
  return removeCollinear(midpoints);
}

/** Drops vertices that lie exactly on the line between their neighbours. */
export function removeCollinear(poly: Polygon): Polygon {
  const out: Polygon = [];
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const a = poly[(i + n - 1) % n] as Point;
    const b = poly[i] as Point;
    const c = poly[(i + 1) % n] as Point;
    if ((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]) !== 0) out.push(b);
  }
  return out;
}

function distToSegment(p: Point, a: Point, b: Point): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = dx * dx + dy * dy;
  const t =
    len === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** Ramer–Douglas–Peucker on an open chain, keeping both ends. */
function rdpChain(chain: Polygon, epsilon: number): Polygon {
  if (chain.length < 3) return chain.slice();
  const a = chain[0] as Point;
  const b = chain[chain.length - 1] as Point;
  let worst = 0;
  let index = 0;
  for (let i = 1; i < chain.length - 1; i++) {
    const d = distToSegment(chain[i] as Point, a, b);
    if (d > worst) {
      worst = d;
      index = i;
    }
  }
  if (worst <= epsilon) return [a, b];
  const left = rdpChain(chain.slice(0, index + 1), epsilon);
  const right = rdpChain(chain.slice(index), epsilon);
  return [...left.slice(0, -1), ...right];
}

/**
 * Step 6: RDP on a closed polygon. It's split at vertex 0 and the vertex farthest from it, and
 * each half is simplified on its own.
 */
export function simplifyClosed(poly: Polygon, epsilon: number): Polygon {
  if (poly.length <= 4) return poly.slice();
  const origin = poly[0] as Point;
  let far = 0;
  let farthest = -1;
  for (let i = 1; i < poly.length; i++) {
    const p = poly[i] as Point;
    const d = (p[0] - origin[0]) ** 2 + (p[1] - origin[1]) ** 2;
    if (d > farthest) {
      farthest = d;
      far = i;
    }
  }
  const first = rdpChain(poly.slice(0, far + 1), epsilon);
  const second = rdpChain([...poly.slice(far), origin], epsilon);
  return [...first.slice(0, -1), ...second.slice(0, -1)];
}

/**
 * Fills shallow notches: removes inward-pointing corners that sit less than `depth` inside the
 * line between their neighbours. Each one would cost a convex part without adding any visible
 * shape. Only ever adds material. `ccw` tells which way the polygon winds (in its own frame).
 */
export function fillShallowNotches(poly: Polygon, depth: number, ccw: boolean): Polygon {
  const out = poly.slice();
  for (let changed = true; changed && out.length > 3;) {
    changed = false;
    for (let i = 0; i < out.length && out.length > 3; i++) {
      const a = out[(i + out.length - 1) % out.length] as Point;
      const b = out[i] as Point;
      const c = out[(i + 1) % out.length] as Point;
      const cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
      const inward = ccw ? cross < 0 : cross > 0;
      const span = Math.hypot(c[0] - a[0], c[1] - a[1]);
      if (inward && span > 0 && Math.abs(cross) / span < depth) {
        out.splice(i, 1);
        changed = true;
        i -= 1;
      }
    }
  }
  return out;
}

/** Signed area: positive when counter-clockwise in a y-up frame. */
export function signedArea(poly: Polygon): number {
  let sum = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i] as Point;
    const b = poly[(i + 1) % poly.length] as Point;
    sum += a[0] * b[1] - b[0] * a[1];
  }
  return sum / 2;
}

export function centroid(poly: Polygon): Point {
  let cx = 0;
  let cy = 0;
  let twice = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i] as Point;
    const b = poly[(i + 1) % poly.length] as Point;
    const cross = a[0] * b[1] - b[0] * a[1];
    twice += cross;
    cx += (a[0] + b[0]) * cross;
    cy += (a[1] + b[1]) * cross;
  }
  if (twice === 0) return poly[0] ?? [0, 0];
  return [cx / (3 * twice), cy / (3 * twice)];
}

function segmentsCross(a: Point, b: Point, c: Point, d: Point): boolean {
  const orient = (p: Point, q: Point, r: Point) =>
    Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  const o1 = orient(a, b, c);
  const o2 = orient(a, b, d);
  const o3 = orient(c, d, a);
  const o4 = orient(c, d, b);
  if (o1 !== o2 && o3 !== o4) return true;
  // Collinear overlaps count as crossing too: they'd make a zero-width sliver.
  const on = (p: Point, q: Point, r: Point) =>
    Math.min(p[0], q[0]) <= r[0] &&
    r[0] <= Math.max(p[0], q[0]) &&
    Math.min(p[1], q[1]) <= r[1] &&
    r[1] <= Math.max(p[1], q[1]);
  return (
    (o1 === 0 && on(a, b, c)) ||
    (o2 === 0 && on(a, b, d)) ||
    (o3 === 0 && on(c, d, a)) ||
    (o4 === 0 && on(c, d, b))
  );
}

/** True when no two non-adjacent edges touch. */
export function isSimple(poly: Polygon): boolean {
  const n = poly.length;
  if (n < 3) return false;
  for (let i = 0; i < n; i++) {
    const a = poly[i] as Point;
    const b = poly[(i + 1) % n] as Point;
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      if (segmentsCross(a, b, poly[j] as Point, poly[(j + 1) % n] as Point)) return false;
    }
  }
  return true;
}

/** Andrew's monotone chain. Counter-clockwise in a y-up frame. */
export function convexHull(points: readonly Point[]): Polygon {
  const pts = [...points].sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  if (pts.length < 3) return pts;
  const cross = (o: Point, a: Point, b: Point) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Point[] = [];
  for (const p of pts) {
    while (
      lower.length >= 2 &&
      cross(lower[lower.length - 2] as Point, lower[lower.length - 1] as Point, p) <= 0
    )
      lower.pop();
    lower.push(p);
  }
  const upper: Point[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i] as Point;
    while (
      upper.length >= 2 &&
      cross(upper[upper.length - 2] as Point, upper[upper.length - 1] as Point, p) <= 0
    )
      upper.pop();
    upper.push(p);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/**
 * The narrowest and widest extents of a shape, from its convex hull: `width` is the smallest
 * distance between two parallel lines enclosing it (rotating calipers), `length` the largest
 * distance between two of its points.
 */
export function extents(poly: Polygon): { width: number; length: number } {
  const hull = convexHull(poly);
  let length = 0;
  for (let i = 0; i < hull.length; i++) {
    for (let j = i + 1; j < hull.length; j++) {
      const a = hull[i] as Point;
      const b = hull[j] as Point;
      length = Math.max(length, Math.hypot(a[0] - b[0], a[1] - b[1]));
    }
  }
  let width = Infinity;
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i] as Point;
    const b = hull[(i + 1) % hull.length] as Point;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len === 0) continue;
    let far = 0;
    for (const p of hull) {
      far = Math.max(
        far,
        Math.abs((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])) / len,
      );
    }
    width = Math.min(width, far);
  }
  return { width: Number.isFinite(width) ? width : 0, length };
}
