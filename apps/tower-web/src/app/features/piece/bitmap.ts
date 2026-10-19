import { paintOp } from '@pictiotheme/canvas-engine';
import type { Piece, ShapePreview } from '@pictiotheme/doodle-shape';
import type { Stroke } from '@pictiotheme/protocol';

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
  // Ink, from the last clear on. `clear` ops would clear in the wrong space, and there are no
  // fills in Doodle Tower.
  const lastClear = strokes.findLastIndex((s) => s.tool === 'clear');
  const ink = make();
  for (const op of strokes.slice(lastClear + 1)) if (op.tool !== 'fill') paintOp(ink.ctx, op);
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
