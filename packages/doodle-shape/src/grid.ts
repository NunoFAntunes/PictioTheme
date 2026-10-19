import type { Stroke } from '@pictiotheme/protocol';

/**
 * A coarse binary raster of a drawing (docs/tower/technical/piece-pipeline.md, steps 1–4).
 * Only the drawing's bounding box is rasterised: cell (0, 0) starts at logical (`x0`, `y0`) and
 * each cell covers `cell` × `cell` logical px. The caller leaves an empty margin around the ink,
 * so the outside can always be flood-filled from the border.
 */
export type Grid = { cols: number; rows: number; data: Uint8Array };

/** Where a grid sits on the logical canvas. */
export type Frame = { x0: number; y0: number; cell: number };

export function createGrid(cols: number, rows: number): Grid {
  return { cols, rows, data: new Uint8Array(cols * rows) };
}

function distToSegmentSq(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const len = dx * dx + dy * dy;
  const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len));
  const ex = px - (ax + t * dx);
  const ey = py - (ay + t * dy);
  return ex * ex + ey * ey;
}

/** Sets every cell whose centre is within `radius` (logical px) of the segment a→b. */
function stampSegment(
  grid: Grid,
  { x0, y0, cell }: Frame,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  radius: number,
  value: 0 | 1,
): void {
  const cax = (ax - x0) / cell;
  const cay = (ay - y0) / cell;
  const cbx = (bx - x0) / cell;
  const cby = (by - y0) / cell;
  const r = radius / cell;
  const left = Math.max(0, Math.floor(Math.min(cax, cbx) - r));
  const right = Math.min(grid.cols - 1, Math.ceil(Math.max(cax, cbx) + r));
  const top = Math.max(0, Math.floor(Math.min(cay, cby) - r));
  const bottom = Math.min(grid.rows - 1, Math.ceil(Math.max(cay, cby) + r));
  const rSq = r * r;
  for (let y = top; y <= bottom; y++) {
    for (let x = left; x <= right; x++) {
      if (distToSegmentSq(x + 0.5, y + 0.5, cax, cay, cbx, cby) <= rSq) {
        grid.data[y * grid.cols + x] = value;
      }
    }
  }
}

/**
 * Step 1: paints the strokes onto the grid in order. Erasers clear cells, `clear` empties the
 * grid. Fills are ignored: Doodle Tower has no bucket, enclosed areas are filled in step 3.
 * Ink is at least `minInkRadius` wide so a 1 px line still marks the cells it crosses.
 */
export function rasterize(
  strokes: readonly Stroke[],
  grid: Grid,
  frame: Frame,
  minInkRadius: number,
): Grid {
  for (const stroke of strokes) {
    if (stroke.tool === 'clear') {
      grid.data.fill(0);
      continue;
    }
    if (stroke.tool === 'fill') continue;
    const erase = stroke.tool === 'eraser';
    const radius = erase ? stroke.size / 2 : Math.max(stroke.size / 2, minInkRadius);
    const { pts } = stroke;
    if (pts.length < 3) continue;
    let ax = pts[0] as number;
    let ay = pts[1] as number;
    if (pts.length === 3) stampSegment(grid, frame, ax, ay, ax, ay, radius, erase ? 0 : 1);
    for (let i = 3; i + 2 < pts.length; i += 3) {
      const bx = pts[i] as number;
      const by = pts[i + 1] as number;
      stampSegment(grid, frame, ax, ay, bx, by, radius, erase ? 0 : 1);
      ax = bx;
      ay = by;
    }
  }
  return grid;
}

/**
 * Chamfer distance (3 for a side step, 4 for a diagonal one) from every cell to the nearest cell
 * where `data` equals `target`, in two passes. With `outsideIsTarget`, the area beyond the grid
 * counts as a target too (for erosion: nothing outside the grid is solid).
 */
function distanceTo(grid: Grid, target: 0 | 1, outsideIsTarget: boolean): Int32Array {
  const { cols, rows, data } = grid;
  const far = 1 << 28;
  const dist = new Int32Array(cols * rows);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      const edge = x === 0 || y === 0 || x === cols - 1 || y === rows - 1;
      dist[i] = (data[i] ? 1 : 0) === target ? 0 : outsideIsTarget && edge ? 3 : far;
    }
  }
  const relax = (i: number, n: number, cost: number) => {
    const d = (dist[n] as number) + cost;
    if (d < (dist[i] as number)) dist[i] = d;
  };
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      if (x > 0) relax(i, i - 1, 3);
      if (y > 0) {
        relax(i, i - cols, 3);
        if (x > 0) relax(i, i - cols - 1, 4);
        if (x < cols - 1) relax(i, i - cols + 1, 4);
      }
    }
  }
  for (let y = rows - 1; y >= 0; y--) {
    for (let x = cols - 1; x >= 0; x--) {
      const i = y * cols + x;
      if (x < cols - 1) relax(i, i + 1, 3);
      if (y < rows - 1) {
        relax(i, i + cols, 3);
        if (x < cols - 1) relax(i, i + cols + 1, 4);
        if (x > 0) relax(i, i + cols - 1, 4);
      }
    }
  }
  return dist;
}

/**
 * The reach of a radius in chamfer units. `3r + 1` gives exactly the discs the pipeline was tuned
 * with: radius 1 is the 3×3 block, radius 2 the 5×5 block without its corners.
 */
const reach = (radius: number) => 3 * radius + 1;

/** Grows the solid by `radius` cells (a disc, approximately), clipped to the grid. */
export function dilate(grid: Grid, radius: number): Grid {
  if (radius <= 0) return { ...grid, data: grid.data.slice() };
  const dist = distanceTo(grid, 1, false);
  const out = createGrid(grid.cols, grid.rows);
  const limit = reach(radius);
  for (let i = 0; i < dist.length; i++) out.data[i] = (dist[i] as number) <= limit ? 1 : 0;
  return out;
}

/** Shrinks the solid by `radius` cells. Beyond the grid counts as empty. */
export function erode(grid: Grid, radius: number): Grid {
  if (radius <= 0) return { ...grid, data: grid.data.slice() };
  const dist = distanceTo(grid, 0, true);
  const out = createGrid(grid.cols, grid.rows);
  const limit = reach(radius);
  for (let i = 0; i < dist.length; i++) out.data[i] = (dist[i] as number) > limit ? 1 : 0;
  return out;
}

/**
 * Morphological closing: fills every notch and gap narrower than about twice `radius`, and only
 * adds cells, so convex parts of the shape stay exactly as drawn. The grid needs an empty margin
 * of more than `radius` cells, or the shape near its edge would be eroded away.
 */
export function closing(grid: Grid, radius: number): Grid {
  return erode(dilate(grid, radius), radius);
}

/**
 * Step 3: everything the outside can't reach is solid. Floods the empty cells 4-connected from
 * the border ring, and returns the complement. The ring always counts as outside, even where
 * thick ink near the canvas edge spilled into it.
 */
export function fillEnclosed(grid: Grid): Grid {
  const { cols, rows, data } = grid;
  const outside = new Uint8Array(cols * rows);
  const stack: number[] = [];
  for (let x = 0; x < cols; x++) stack.push(x, (rows - 1) * cols + x);
  for (let y = 1; y + 1 < rows; y++) stack.push(y * cols, y * cols + cols - 1);
  for (const i of stack) outside[i] = 1;
  while (stack.length) {
    const i = stack.pop() as number;
    const x = i % cols;
    const y = (i - x) / cols;
    const visit = (nx: number, ny: number) => {
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) return;
      const n = ny * cols + nx;
      if (outside[n] || data[n]) return;
      outside[n] = 1;
      stack.push(n);
    };
    visit(x + 1, y);
    visit(x - 1, y);
    visit(x, y + 1);
    visit(x, y - 1);
  }
  const out = createGrid(cols, rows);
  for (let i = 0; i < outside.length; i++) out.data[i] = outside[i] ? 0 : 1;
  return out;
}

/** 8-connected components of the solid cells: a label per cell (0 = empty) and each size. */
export function components(grid: Grid): { labels: Int32Array; sizes: number[] } {
  const { cols, rows, data } = grid;
  const labels = new Int32Array(cols * rows);
  const sizes = [0];
  for (let start = 0; start < data.length; start++) {
    if (!data[start] || labels[start]) continue;
    const label = sizes.length;
    let size = 0;
    const stack = [start];
    labels[start] = label;
    while (stack.length) {
      const i = stack.pop() as number;
      size++;
      const x = i % cols;
      const y = (i - x) / cols;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
          const n = ny * cols + nx;
          if (data[n] && !labels[n]) {
            labels[n] = label;
            stack.push(n);
          }
        }
      }
    }
    sizes.push(size);
  }
  return { labels, sizes };
}

/** Cells of `label` that touch a cell outside it (4-neighbourhood). */
function edgeCells(labels: Int32Array, cols: number, label: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < labels.length; i++) {
    if (labels[i] !== label) continue;
    const x = i % cols;
    if (
      labels[i - 1] !== label ||
      labels[i + 1] !== label ||
      labels[i - cols] !== label ||
      labels[i + cols] !== label ||
      x === 0
    ) {
      out.push(i);
    }
  }
  return out;
}

/** Step 4 result: the piece's cells and the ink that didn't make it in (for the preview). */
export type Blob = { main: Grid; dropped: Grid; cells: number };

/**
 * Step 4: keeps the largest component. Components of at least `minCells` within `bridge` cells
 * of it are joined to it (a balloon's string, the dashes around a shining lightbulb), and
 * everything else is dropped. Returns null when even the largest component is smaller than
 * `minCells`.
 *
 * A join is a three-cell-wide bridge, rounded off with a closing of `fillet` cells around it, so
 * the piece gets a smooth web where the mark meets the object rather than a thin stick (the way
 * you'd cut a sticker out around it).
 */
export function pickBlob(
  solid: Grid,
  bridge: number,
  minCells: number,
  fillet: number,
): Blob | null {
  const { cols, rows } = solid;
  const { labels, sizes } = components(solid);
  let mainLabel = 0;
  for (let l = 1; l < sizes.length; l++) {
    if ((sizes[l] as number) > (sizes[mainLabel] ?? 0)) mainLabel = l;
  }
  if (!mainLabel || (sizes[mainLabel] as number) < minCells) return null;

  const main = createGrid(cols, rows);
  for (let i = 0; i < labels.length; i++) if (labels[i] === mainLabel) main.data[i] = 1;

  const mainEdge = edgeCells(labels, cols, mainLabel);
  const bridgeSq = bridge * bridge;
  const bridges = createGrid(cols, rows);
  for (let l = 1; l < sizes.length; l++) {
    if (l === mainLabel || (sizes[l] as number) < minCells) continue;
    let best = Infinity;
    let from = 0;
    let to = 0;
    for (const a of edgeCells(labels, cols, l)) {
      const ax = a % cols;
      const ay = (a - ax) / cols;
      for (const b of mainEdge) {
        const bx = b % cols;
        const by = (b - bx) / cols;
        const d = (ax - bx) ** 2 + (ay - by) ** 2;
        if (d < best) {
          best = d;
          from = a;
          to = b;
        }
      }
    }
    if (best > bridgeSq) continue;
    for (let i = 0; i < labels.length; i++) if (labels[i] === l) main.data[i] = 1;
    const fx = from % cols;
    const tx = to % cols;
    // The bridge is stamped in cell coordinates.
    const [ax, ay, bx, by] = [fx + 0.5, (from - fx) / cols + 0.5, tx + 0.5, (to - tx) / cols + 0.5];
    stampCells(main, ax, ay, bx, by, 1.5);
    stampCells(bridges, ax, ay, bx, by, 1.5);
  }

  // Round off the joins: the closing's new cells, but only near a bridge.
  if (fillet > 0 && bridges.data.includes(1)) {
    const rounded = closing(main, fillet);
    const near = dilate(bridges, fillet + 1);
    for (let i = 0; i < main.data.length; i++) {
      if (rounded.data[i] && near.data[i]) main.data[i] = 1;
    }
  }

  const filled = fillEnclosed(main);
  repairSaddles(filled);
  const dropped = createGrid(cols, rows);
  let cells = 0;
  for (let i = 0; i < filled.data.length; i++) {
    if (filled.data[i]) cells++;
    else if (solid.data[i]) dropped.data[i] = 1;
  }
  return { main: filled, dropped, cells };
}

function stampCells(grid: Grid, ax: number, ay: number, bx: number, by: number, radius: number) {
  const rSq = radius * radius;
  for (
    let y = Math.floor(Math.min(ay, by) - radius);
    y <= Math.ceil(Math.max(ay, by) + radius);
    y++
  ) {
    for (
      let x = Math.floor(Math.min(ax, bx) - radius);
      x <= Math.ceil(Math.max(ax, bx) + radius);
      x++
    ) {
      if (x < 0 || y < 0 || x >= grid.cols || y >= grid.rows) continue;
      if (distToSegmentSq(x + 0.5, y + 0.5, ax, ay, bx, by) <= rSq)
        grid.data[y * grid.cols + x] = 1;
    }
  }
}

/**
 * Two cells that touch only at a corner (a "saddle") would make the outline cross itself.
 * Fills one of the other two cells of each such 2×2 block, then fills any hole that closed, until
 * neither is left. Afterwards the solid is 4-connected with no holes: its outline is one loop.
 */
export function repairSaddles(grid: Grid): void {
  const { cols, rows, data } = grid;
  for (let pass = 0; pass < 16; pass++) {
    let changed = false;
    for (let y = 0; y + 1 < rows; y++) {
      for (let x = 0; x + 1 < cols; x++) {
        const i = y * cols + x;
        const a = data[i];
        const b = data[i + 1];
        const c = data[i + cols];
        const d = data[i + cols + 1];
        if (a && d && !b && !c) {
          data[i + 1] = 1;
          changed = true;
        } else if (b && c && !a && !d) {
          data[i] = 1;
          changed = true;
        }
      }
    }
    if (!changed) return;
    const filled = fillEnclosed(grid);
    data.set(filled.data);
  }
}
