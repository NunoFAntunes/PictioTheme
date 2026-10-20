import { CANVAS_HEIGHT, CANVAS_WIDTH } from '@pictiotheme/protocol';
import type { StrokeModel } from './stroke-model';
import { paintOp, type PaintOptions } from './paint';

/**
 * Renders the stroke model onto a display canvas.
 * Finished operations are painted once onto an offscreen "base" layer; the stroke still being
 * drawn is repainted on top each frame. History rewrites (undo, reset) repaint the base.
 *
 * `background` (a picture to draw over, such as your current avatar) is the base's bottom layer,
 * so the eraser, fills and clearing treat it like paint: `fit` places it on the canvas.
 */
export function createRenderer(
  display: HTMLCanvasElement,
  model: StrokeModel,
  size: { width: number; height: number } = { width: CANVAS_WIDTH, height: CANVAS_HEIGHT },
  background?: { image: HTMLImageElement; fit: number },
  paint: PaintOptions = {},
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
      if (background) paintBackground(baseCtx, background, width, height);
      painted = 0;
      epoch = model.epoch;
    }
    for (; painted < committed; painted++) {
      const op = strokes[painted];
      if (op) paintOp(baseCtx, op, paint);
    }

    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(base, 0, 0);
    if (open) paintOp(ctx, open, paint);
  };

  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(render);
  };
  const unsubscribe = model.subscribe(schedule);
  // Repaint from scratch once the background has loaded.
  const onBackground = () => {
    epoch = -1;
    schedule();
  };
  background?.image.addEventListener('load', onBackground);
  render();

  return () => {
    background?.image.removeEventListener('load', onBackground);
    unsubscribe();
    if (frame) cancelAnimationFrame(frame);
  };
}

/** The background scaled to fit `fit` of the canvas, centred. Nothing until it has loaded. */
function paintBackground(
  ctx: CanvasRenderingContext2D,
  { image, fit }: { image: HTMLImageElement; fit: number },
  width: number,
  height: number,
) {
  if (!image.complete || !image.naturalWidth) return;
  const scale = Math.min((width * fit) / image.naturalWidth, (height * fit) / image.naturalHeight);
  const w = image.naturalWidth * scale;
  const h = image.naturalHeight * scale;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, (width - w) / 2, (height - h) / 2, w, h);
}
