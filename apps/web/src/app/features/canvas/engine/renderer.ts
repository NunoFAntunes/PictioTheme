import { CANVAS_HEIGHT, CANVAS_WIDTH } from '@pictiotheme/protocol';
import type { StrokeModel } from '../../../realtime';
import { paintOp } from './paint';

/**
 * Renders the stroke model onto a display canvas.
 * Finished operations are painted once onto an offscreen "base" layer; the stroke still being
 * drawn is repainted on top each frame. History rewrites (undo, reset) repaint the base.
 */
export function createRenderer(
  display: HTMLCanvasElement,
  model: StrokeModel,
  size: { width: number; height: number } = { width: CANVAS_WIDTH, height: CANVAS_HEIGHT },
): () => void {
  const { width, height } = size;
  display.width = width;
  display.height = height;
  const ctx = display.getContext('2d');
  const base = document.createElement('canvas');
  base.width = width;
  base.height = height;
  const baseCtx = base.getContext('2d', { willReadFrequently: true }); // flood fill reads pixels
  if (!ctx || !baseCtx) return () => {};

  let painted = 0;
  let epoch = -1;
  let frame = 0;

  const render = () => {
    frame = 0;
    const { strokes, openId } = model;
    const last = strokes[strokes.length - 1];
    const open = openId !== null && last?.id === openId ? last : null;
    const committed = open ? strokes.length - 1 : strokes.length;

    if (epoch !== model.epoch || painted > committed) {
      baseCtx.clearRect(0, 0, width, height);
      painted = 0;
      epoch = model.epoch;
    }
    for (; painted < committed; painted++) {
      const op = strokes[painted];
      if (op) paintOp(baseCtx, op);
    }

    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(base, 0, 0);
    if (open) paintOp(ctx, open);
  };

  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(render);
  };
  const unsubscribe = model.subscribe(schedule);
  render();

  return () => {
    unsubscribe();
    if (frame) cancelAnimationFrame(frame);
  };
}
