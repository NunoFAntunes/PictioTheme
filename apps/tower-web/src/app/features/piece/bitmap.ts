import { paintOp } from '@pictiotheme/canvas-engine';
import type { Piece, ShapePreview } from '@pictiotheme/doodle-shape';
import { CANVAS_HEIGHT, CANVAS_WIDTH, type Stroke } from '@pictiotheme/protocol';

/**
 * A piece's look: the doodle cut out of paper. The silhouette is filled with paper and outlined,
 * and the ink is drawn on top, trimmed to a little beyond the silhouette so far-away scribbles
 * that weren't part of the piece don't float around it.
 *
 * The bitmap covers the silhouette's bounds plus `margin` logical px on each side, at `density`
 * bitmap px per logical px. The tower renderer maps it back with the piece's origin and scale.
 */
export type PieceBitmap = {
  canvas: HTMLCanvasElement;
  /** The bitmap's top-left corner in logical canvas px. */
  x: number;
  y: number;
  /** Its size in logical canvas px. */
  width: number;
  height: number;
};

/** Bitmap px per world unit: crisp at the tower view's usual zoom on a 2× screen. */
const PX_PER_UNIT = 160;

function silhouettePath(flat: readonly number[]): Path2D {
  const path = new Path2D();
  if (flat.length < 6) return path;
  path.moveTo(flat[0] as number, flat[1] as number);
  for (let i = 2; i + 1 < flat.length; i += 2)
    path.lineTo(flat[i] as number, flat[i + 1] as number);
  path.closePath();
  return path;
}

/**
 * Lines are painted straight into the (scaled) bitmap, so they stay crisp. A fill needs the
 * drawing's pixels at canvas size to know where it goes: the drawing is replayed at canvas size
 * alongside, and what each fill changed there is laid into the bitmap in turn.
 */
function paintInk(ctx: CanvasRenderingContext2D, ops: readonly Stroke[]): void {
  if (!ops.some((op) => op.tool === 'fill')) {
    for (const op of ops) paintOp(ctx, op);
    return;
  }
  const full = document.createElement('canvas');
  full.width = CANVAS_WIDTH;
  full.height = CANVAS_HEIGHT;
  const fullCtx = full.getContext('2d', { willReadFrequently: true });
  const patch = document.createElement('canvas');
  patch.width = CANVAS_WIDTH;
  patch.height = CANVAS_HEIGHT;
  const patchCtx = patch.getContext('2d');
  if (!fullCtx || !patchCtx) return;
  for (const op of ops) {
    if (op.tool !== 'fill') {
      paintOp(fullCtx, op);
      paintOp(ctx, op);
      continue;
    }
    const before = fullCtx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT).data;
    paintOp(fullCtx, op, { enclosedFills: true });
    const after = fullCtx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    const changed = after.data;
    for (let i = 0; i < changed.length; i += 4) {
      if (
        changed[i] === before[i] &&
        changed[i + 1] === before[i + 1] &&
        changed[i + 2] === before[i + 2] &&
        changed[i + 3] === before[i + 3]
      ) {
        changed[i + 3] = 0;
      }
    }
    patchCtx.putImageData(after, 0, 0);
    ctx.drawImage(patch, 0, 0);
  }
}

export function renderPieceBitmap(
  strokes: readonly Stroke[],
  piece: Piece,
  preview: ShapePreview,
  paper = '#fbf7ee',
  edge = '#1b2433',
): PieceBitmap {
  const margin = preview.frame.cell * 3;
  const x = piece.bounds.x - margin;
  const y = piece.bounds.y - margin;
  const width = piece.bounds.width + 2 * margin;
  const height = piece.bounds.height + 2 * margin;
  const density = Math.min(2, Math.max(0.2, PX_PER_UNIT * piece.scale));
  const toBitmap = (ctx: CanvasRenderingContext2D) =>
    ctx.setTransform(density, 0, 0, density, -x * density, -y * density);

  const make = () => {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.ceil(width * density));
    canvas.height = Math.max(1, Math.ceil(height * density));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas unavailable');
    toBitmap(ctx);
    return { canvas, ctx };
  };

  const path = silhouettePath(preview.silhouette);
  // Ink, from the last clear on (a `clear` op would clear in the wrong space).
  const lastClear = strokes.findLastIndex((s) => s.tool === 'clear');
  const ink = make();
  paintInk(ink.ctx, strokes.slice(lastClear + 1));
  // Trim it to the silhouette grown by two cells.
  const mask = make();
  mask.ctx.fillStyle = '#000';
  mask.ctx.strokeStyle = '#000';
  mask.ctx.lineJoin = 'round';
  mask.ctx.lineWidth = preview.frame.cell * 4;
  mask.ctx.fill(path);
  mask.ctx.stroke(path);
  ink.ctx.setTransform(1, 0, 0, 1, 0, 0);
  ink.ctx.globalCompositeOperation = 'destination-in';
  ink.ctx.drawImage(mask.canvas, 0, 0);

  const out = make();
  out.ctx.fillStyle = paper;
  out.ctx.fill(path);
  out.ctx.setTransform(1, 0, 0, 1, 0, 0);
  out.ctx.drawImage(ink.canvas, 0, 0);
  toBitmap(out.ctx);
  out.ctx.lineJoin = 'round';
  out.ctx.lineWidth = 2.5 / density;
  out.ctx.strokeStyle = edge;
  out.ctx.stroke(path);
  return { canvas: out.canvas, x, y, width, height };
}
