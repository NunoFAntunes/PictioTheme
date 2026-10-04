import type { Stroke } from '@pictiotheme/protocol';
import { getStroke } from 'perfect-freehand';
import { floodFill, hexToRgba } from './flood-fill';

/** Paints one drawing operation onto a context at logical resolution (the canvas's own size). */

type LineStroke = Extract<Stroke, { pts: number[] }>;

function toPoints(pts: readonly number[]): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (let i = 0; i + 2 < pts.length; i += 3) {
    out.push([pts[i] as number, pts[i + 1] as number, pts[i + 2] as number]);
  }
  return out;
}

/** perfect-freehand outline → a smooth closed path (midpoint quadratic curves). */
function outlinePath(outline: number[][]): Path2D {
  const path = new Path2D();
  const n = outline.length;
  if (n < 2) return path;
  const [first = [0, 0]] = outline;
  path.moveTo(first[0] ?? 0, first[1] ?? 0);
  for (let i = 0; i < n; i++) {
    const [ax = 0, ay = 0] = outline[i] ?? [];
    const [bx = 0, by = 0] = outline[(i + 1) % n] ?? [];
    path.quadraticCurveTo(ax, ay, (ax + bx) / 2, (ay + by) / 2);
  }
  path.closePath();
  return path;
}

function paintLine(ctx: CanvasRenderingContext2D, stroke: LineStroke): void {
  const points = toPoints(stroke.pts);
  // A mouse reports a constant 0.5: let perfect-freehand simulate pressure from speed instead.
  const realPressure = points.some(([, , p]) => p !== 0.5);
  const outline = getStroke(points, {
    size: stroke.size,
    thinning: realPressure ? 0.6 : 0.35,
    smoothing: 0.5,
    streamline: 0.4,
    simulatePressure: !realPressure,
    last: true,
  });
  ctx.save();
  // One fill per stroke, so overlapping segments don't darken (drawing-tools.md: opacity done right).
  ctx.globalAlpha = stroke.opacity;
  ctx.globalCompositeOperation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over';
  ctx.fillStyle = stroke.color;
  ctx.fill(outlinePath(outline));
  ctx.restore();
}

export function paintOp(ctx: CanvasRenderingContext2D, op: Stroke): void {
  const { width, height } = ctx.canvas;
  switch (op.tool) {
    case 'clear':
      ctx.clearRect(0, 0, width, height);
      return;
    case 'fill': {
      const image = ctx.getImageData(0, 0, width, height);
      floodFill(image.data, width, height, op.x, op.y, hexToRgba(op.color), op.tolerance);
      ctx.putImageData(image, 0, 0);
      return;
    }
    default:
      paintLine(ctx, op);
  }
}
