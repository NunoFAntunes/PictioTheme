import { CANVAS_HEIGHT, CANVAS_WIDTH, type Stroke } from '@pictiotheme/protocol';
import { makeCCW, quickDecomp, removeCollinearPoints, removeDuplicatePoints } from 'poly-decomp-es';
import {
  closing,
  createGrid,
  dilate,
  fillEnclosed,
  pickBlob,
  rasterize,
  repairSaddles,
  type Frame,
  type Grid,
} from './grid';
import { meltGrid, type Melt } from './melt';
import {
  centroid,
  convexHull,
  extents,
  fillShallowNotches,
  isSimple,
  signedArea,
  simplifyClosed,
  traceOutline,
  type Point,
  type Polygon,
} from './polygon';

/** Pipeline settings (docs/tower/technical/piece-pipeline.md). Lengths in cells unless noted. */
export type ShapeConfig = {
  /**
   * Cells along the drawing's longest side. The grid is sized to the drawing, not the canvas, so
   * a tiny doodle keeps as much detail as a big one: resolution is normalized as well as scale.
   */
  resolution: number;
  /** Logical px per cell, at least and at most (very small or very large drawings). */
  minCell: number;
  maxCell: number;
  /** Step 2: how far ink is thickened. */
  thicken: number;
  /** Step 3: gaps up to about twice this are closed before filling. */
  close: number;
  /** Step 4: blobs this close to the main one are joined to it. */
  bridge: number;
  /** Step 4: how much a join is rounded off where it meets the object. */
  fillet: number;
  /** Step 4: smaller blobs are ignored, and a drawing smaller than this makes no piece. */
  minCells: number;
  /** Step 6: how far the outline may stray from the cells, in cells. */
  epsilon: number;
  /**
   * Step 6: when the outline has too many corners or parts, notches narrower than about twice
   * each of these radii (cells) are filled in turn until it fits. Filling notches keeps the
   * drawing's shape; cutting corners (a coarser simplification) is only the last resort.
   */
  smoothing: readonly number[];
  maxVertices: number;
  maxParts: number;
  /** Step 7, in world units (the platform is 6 wide). */
  targetArea: number;
  maxLength: number;
  minThickness: number;
};

export const DEFAULT_SHAPE_CONFIG: ShapeConfig = {
  resolution: 72,
  minCell: 1.5,
  maxCell: 12,
  thicken: 1,
  close: 2,
  bridge: 5,
  fillet: 2,
  minCells: 6,
  epsilon: 0.75,
  smoothing: [1, 2, 3, 4, 6, 8],
  maxVertices: 64,
  maxParts: 16,
  targetArea: 2,
  maxLength: 4.2,
  minThickness: 0.25,
};

/** Flat `[x0, y0, x1, y1, …]`. */
export type FlatPolygon = number[];

/** A drawing turned into a physics piece. World units: y up, centred on the centroid. */
export type Piece = {
  /** The simplified silhouette, counter-clockwise. */
  outline: FlatPolygon;
  /** Convex parts covering the outline: one compound collider. */
  parts: FlatPolygon[];
  /** Area of the outline, in world units². */
  area: number;
  /** World units per logical px: `world = (logical − origin) × scale`, with y flipped. */
  scale: number;
  /** The centroid in logical canvas px: where the drawing's pixels sit relative to the body. */
  origin: { x: number; y: number };
  /** The silhouette's bounding box in logical canvas px, to crop the doodle's bitmap. */
  bounds: { x: number; y: number; width: number; height: number };
  /** Which normalization rule set the scale. */
  limitedBy: 'area' | 'length' | 'thickness';
  /** A melted piece: how its drawing droops (meltShift), to warp the doodle the same way. */
  melt?: Melt;
};

/** What the drawer's live preview shows: the cells that make the piece and the ones dropped. */
export type ShapePreview = {
  /** Where the grid sits on the logical canvas: cell (0, 0) starts at (`x0`, `y0`). */
  frame: Frame;
  cols: number;
  rows: number;
  /** 1 = part of the piece, 2 = ink dropped because it's too far from the piece. */
  cells: Uint8Array;
  /** The simplified silhouette in logical px. */
  silhouette: FlatPolygon;
};

export type ShapeResult =
  | { ok: true; piece: Piece; preview: ShapePreview }
  | { ok: false; reason: 'blank'; preview: ShapePreview | null };

const flat = (poly: Polygon): FlatPolygon => poly.flatMap(([x, y]) => [x, y]);

type Shape = { cells: Grid; simplified: Polygon; parts: Polygon[] };

/**
 * Steps 5–6: the outline of the cells, simplified and split into convex parts, within the corner
 * and part limits. First as drawn; then with ever wider notches filled (`smoothing`), which keeps
 * the outside of the shape exactly as drawn; and only if that isn't enough, with ever coarser
 * simplification, and finally the convex hull, so there's always a valid piece.
 */
function shapeOf(main: Grid, frame: Frame, config: ShapeConfig): Shape | null {
  const { cell } = frame;
  const toLogical = ([x, y]: Point): Point => [frame.x0 + x * cell, frame.y0 + y * cell];
  const fits = (outline: Polygon, epsilon: number) => {
    let simplified = simplifyClosed(outline, epsilon);
    // Logical px are y-down, so a polygon that's counter-clockwise on screen has negative area.
    simplified = fillShallowNotches(simplified, cell, signedArea(simplified) > 0);
    if (simplified.length < 3 || simplified.length > config.maxVertices) return null;
    if (!isSimple(simplified)) return null;
    const split = decompose(simplified);
    return split && split.parts.length <= config.maxParts ? split : null;
  };

  let cells = main;
  let outline = traceOutline(main).map(toLogical);
  if (outline.length < 3) return null;
  for (const radius of [0, ...config.smoothing]) {
    if (radius > 0) {
      cells = fillEnclosed(closing(main, radius));
      repairSaddles(cells);
      outline = traceOutline(cells).map(toLogical);
    }
    const shape = fits(outline, config.epsilon * cell);
    if (shape) return { cells, ...shape };
  }
  for (let epsilon = config.epsilon * cell * 1.5, i = 0; i < 10; i++, epsilon *= 1.4) {
    const shape = fits(outline, epsilon);
    if (shape) return { cells, ...shape };
  }
  const hull = convexHull(outline);
  return { cells, simplified: hull, parts: [hull] };
}

/**
 * Convex parts of a simple polygon (Bayazit, via poly-decomp), with the polygon as cleaned up for
 * it (duplicate and nearly collinear corners removed), which becomes the outline so the outline
 * and its parts always cover exactly the same area. Null if it fails.
 */
function decompose(poly: Polygon): { simplified: Polygon; parts: Polygon[] } | null {
  // Logical px are y-down: flip so "counter-clockwise" means what poly-decomp expects.
  const flipped: Polygon = poly.map(([x, y]) => [x, -y]);
  makeCCW(flipped);
  removeDuplicatePoints(flipped, 1e-6);
  removeCollinearPoints(flipped, 0.01);
  if (flipped.length < 3) return null;
  const unflip = (p: Polygon) => p.map(([x, y]): Point => [x, -y]);
  const simplified = unflip(flipped);
  if (flipped.length === 3 || convexHull(flipped).length === flipped.length) {
    return { simplified, parts: [simplified] };
  }
  const parts = quickDecomp(flipped);
  if (!parts.length) return null;
  return {
    simplified,
    parts: parts.filter((p) => p.length >= 3 && Math.abs(signedArea(p)) > 1e-6).map(unflip),
  };
}

function previewOf(main: Grid, dropped: Grid, frame: Frame, silhouette: Polygon): ShapePreview {
  const cells = new Uint8Array(main.data.length);
  for (let i = 0; i < cells.length; i++) cells[i] = main.data[i] ? 1 : dropped.data[i] ? 2 : 0;
  return { frame, cols: main.cols, rows: main.rows, cells, silhouette: flat(silhouette) };
}

/**
 * The grid for a drawing: the bounding box of the ink still visible (after the last clear),
 * divided into about `resolution` cells along its longest side, plus an empty margin wide enough
 * for thickening and closing. Null when there's no ink.
 */
function frameFor(
  strokes: readonly Stroke[],
  config: ShapeConfig,
  canvas: { width: number; height: number },
) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const stroke of strokes) {
    if (stroke.tool === 'clear') {
      minX = minY = Infinity;
      maxX = maxY = -Infinity;
      continue;
    }
    if (stroke.tool !== 'brush') continue;
    const r = stroke.size / 2;
    for (let i = 0; i + 2 < stroke.pts.length; i += 3) {
      const x = stroke.pts[i] as number;
      const y = stroke.pts[i + 1] as number;
      minX = Math.min(minX, x - r);
      minY = Math.min(minY, y - r);
      maxX = Math.max(maxX, x + r);
      maxY = Math.max(maxY, y + r);
    }
  }
  if (minX > maxX) return null;
  minX = Math.max(minX, -1);
  minY = Math.max(minY, -1);
  maxX = Math.min(maxX, canvas.width + 1);
  maxY = Math.min(maxY, canvas.height + 1);
  const longest = Math.max(maxX - minX, maxY - minY, 1);
  const cell = Math.min(config.maxCell, Math.max(config.minCell, longest / config.resolution));
  // Room for thickening and every closing: a closing that reaches the grid's edge would erode
  // the shape there.
  const margin = config.thicken + Math.max(config.close, config.fillet, ...config.smoothing) + 3;
  const frame: Frame = { x0: minX - margin * cell, y0: minY - margin * cell, cell };
  const cols = Math.ceil((maxX - minX) / cell) + 2 * margin;
  const rows = Math.ceil((maxY - minY) / cell) + 2 * margin;
  return { frame, grid: createGrid(cols, rows) };
}

/**
 * The whole pipeline: strokes in logical canvas px → a normalized, decomposed piece.
 * Pure and deterministic: the server's result is authoritative, and the browser runs the same
 * code for the drawer's live preview.
 */
export function makePiece(
  strokes: readonly Stroke[],
  config: ShapeConfig = DEFAULT_SHAPE_CONFIG,
  canvas = { width: CANVAS_WIDTH, height: CANVAS_HEIGHT },
  options: { melt?: boolean } = {},
): ShapeResult {
  const area = frameFor(strokes, config, canvas);
  if (!area) return { ok: false, reason: 'blank', preview: null };
  const { frame } = area;
  const { cell } = frame;

  // 1–3: rasterise, thicken, close small gaps, fill what's enclosed.
  const ink = rasterize(strokes, area.grid, frame, cell * 0.75);
  const thick = dilate(ink, config.thicken);
  const solid = fillEnclosed(closing(thick, config.close));
  // 4: the main blob.
  const picked = pickBlob(solid, config.bridge, config.minCells, config.fillet);
  if (!picked) return { ok: false, reason: 'blank', preview: null };
  // The Melt curse: the cells droop and round off before they're traced.
  const melted = options.melt ? meltGrid(picked.main, frame) : null;
  const blob = melted
    ? { main: melted.cells, dropped: createGrid(melted.cells.cols, melted.cells.rows) }
    : picked;

  // 5–6: outline in logical px, simplified, split into convex parts.
  const shape = shapeOf(blob.main, frame, config);
  if (!shape) return { ok: false, reason: 'blank', preview: null };
  const { simplified, parts } = shape;
  const preview = previewOf(shape.cells, blob.dropped, frame, simplified);

  // 7: normalize the scale.
  const areaPx = Math.abs(signedArea(simplified));
  if (areaPx <= 0) return { ok: false, reason: 'blank', preview };
  const { width, length } = extents(simplified);
  let scale = Math.sqrt(config.targetArea / areaPx);
  let limitedBy: Piece['limitedBy'] = 'area';
  if (width > 0 && scale * width < config.minThickness) {
    scale = config.minThickness / width;
    limitedBy = 'thickness';
  }
  if (scale * length > config.maxLength) {
    scale = config.maxLength / length;
    limitedBy = 'length';
  }

  const [cx, cy] = centroid(simplified);
  const toWorld = ([x, y]: Point): Point => [(x - cx) * scale, -(y - cy) * scale];
  const worldOutline = simplified.map(toWorld);
  if (signedArea(worldOutline) < 0) worldOutline.reverse();
  const worldParts = parts.map((p) => {
    const w = p.map(toWorld);
    if (signedArea(w) < 0) w.reverse();
    return w;
  });

  const xs = simplified.map((p) => p[0]);
  const ys = simplified.map((p) => p[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return {
    ok: true,
    piece: {
      outline: flat(worldOutline),
      parts: worldParts.map(flat),
      area: Math.abs(signedArea(worldOutline)),
      scale,
      origin: { x: cx, y: cy },
      bounds: { x: minX, y: minY, width: Math.max(...xs) - minX, height: Math.max(...ys) - minY },
      limitedBy,
      ...(melted && { melt: melted.melt }),
    },
    preview,
  };
}

/**
 * The same piece, `areaFactor` times the area (the `big_ice` curse, docs/tower/planning/power-ups.md).
 * The drawing stays where it is on the canvas, so only the world geometry and the scale grow; the
 * doodle's bitmap follows through `scale`. Caps on length don't apply: being too big is the point.
 */
export function bloat<T extends Piece>(piece: T, areaFactor: number): T {
  const k = Math.sqrt(areaFactor);
  const grow = (poly: FlatPolygon) => poly.map((v) => v * k);
  return {
    ...piece,
    outline: grow(piece.outline),
    parts: piece.parts.map(grow),
    area: piece.area * areaFactor,
    scale: piece.scale * k,
  };
}
