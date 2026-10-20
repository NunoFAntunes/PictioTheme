import { createPointerGate, isEnclosed, pointPressure } from '@pictiotheme/canvas-engine';
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '@pictiotheme/protocol';
import type { TowerDrawOp } from '@pictiotheme/protocol/tower';
import { findClosedShape, type Bounds, type ClosedShape } from './closed-shape';
import { ERASER_SIZE, FILL_TOLERANCE, type DrawSettings } from './tools';

/**
 * Pointer input → stroke operations, handed to `emit` (which applies them to the stroke model, and
 * in a match also sends them). Plain TypeScript, no
 * React: strokes never go through React state. Points are in the fixed 1200×900 logical canvas
 * whatever size the canvas is on screen. One pointer draws at a time and palms are rejected once
 * a pen is seen (the shared pointer gate).
 *
 * The bucket fills where it's tapped only when that's inside a closed shape: the canvas's own
 * pixels are checked first, and a tap on the background (or in a shape with a gap) is refused
 * with `onFillRefused` instead of being sent.
 *
 * When a brush stroke closes a shape, `onShapeClosed` hears where it is (the board offers colours
 * for it): the canvas is read as the stroke starts and again once it's painted.
 */

const MIN_DISTANCE = 1.5;

export type DrawingInputDeps = {
  emit(op: TowerDrawOp): void;
  getSettings(): DrawSettings;
  isEnabled(): boolean;
  onFillRefused?(): void;
  onShapeClosed?(shape: ClosedShape): void;
};

let strokeCounter = 0;

/** A fresh id for a stroke operation. */
export function nextOpId(): string {
  strokeCounter += 1;
  return `t${strokeCounter}`;
}

export function attachDrawingInput(canvas: HTMLCanvasElement, deps: DrawingInputDeps): () => void {
  const gate = createPointerGate();
  let strokeId: string | null = null;
  let last: { x: number; y: number } | null = null;
  // While a brush stroke is drawn: the canvas before it, and the stroke's bounds so far.
  let before: Uint8ClampedArray | null = null;
  let bounds: Bounds | null = null;

  const readPixels = () =>
    canvas.getContext('2d')?.getImageData(0, 0, canvas.width, canvas.height).data ?? null;
  const grow = (x: number, y: number) => {
    if (!bounds) return;
    bounds.minX = Math.min(bounds.minX, x);
    bounds.maxX = Math.max(bounds.maxX, x);
    bounds.minY = Math.min(bounds.minY, y);
    bounds.maxY = Math.max(bounds.maxY, y);
  };

  const toLogical = (e: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * CANVAS_WIDTH);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * CANVAS_HEIGHT);
    return {
      x: Math.min(CANVAS_WIDTH, Math.max(0, x)),
      y: Math.min(CANVAS_HEIGHT, Math.max(0, y)),
    };
  };

  const onDown = (e: PointerEvent) => {
    if (e.button !== 0 || !deps.isEnabled() || !gate.claim(e)) return;
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    const settings = deps.getSettings();
    const { x, y } = toLogical(e);
    if (settings.tool === 'fill') {
      fill(x, y, settings.color);
      return;
    }
    strokeId = nextOpId();
    last = { x, y };
    // Not painted yet, so the canvas is still the drawing without this stroke.
    if (settings.tool === 'brush' && deps.onShapeClosed) {
      before = readPixels();
      bounds = { minX: x, maxX: x, minY: y, maxY: y };
    }
    deps.emit({
      t: 'draw:begin',
      id: strokeId,
      tool: settings.tool,
      color: settings.color,
      size: settings.tool === 'eraser' ? ERASER_SIZE : settings.size,
      opacity: 1,
      x,
      y,
    });
  };

  const fill = (x: number, y: number, color: string) => {
    gate.release();
    // The canvas shows the whole drawing at logical size (nothing is mid-stroke on a tap).
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    if (!isEnclosed(data, width, height, x, y, FILL_TOLERANCE)) {
      deps.onFillRefused?.();
      return;
    }
    deps.emit({ t: 'draw:fill', id: nextOpId(), x, y, color, tolerance: FILL_TOLERANCE });
  };

  const onMove = (e: PointerEvent) => {
    gate.observe(e);
    if (!strokeId || !gate.owns(e)) return;
    const pts: number[] = [];
    for (const event of e.getCoalescedEvents?.() ?? [e]) {
      const p = toLogical(event);
      if (last && Math.hypot(p.x - last.x, p.y - last.y) < MIN_DISTANCE) continue;
      pts.push(p.x, p.y, pointPressure(event));
      grow(p.x, p.y);
      last = p;
    }
    if (pts.length) deps.emit({ t: 'draw:pts', id: strokeId, pts });
  };

  const onUp = (e: PointerEvent) => {
    if (!strokeId || !gate.owns(e)) return;
    deps.emit({ t: 'draw:end', id: strokeId });
    strokeId = null;
    last = null;
    gate.release();
    if (before && bounds) checkClosed(before, bounds);
    before = null;
    bounds = null;
  };

  // The renderer paints the finished stroke in the next frame; look at it just after.
  const checkClosed = (pixels: Uint8ClampedArray, stroke: Bounds) => {
    requestAnimationFrame(() => {
      if (strokeId || !deps.isEnabled()) return;
      const after = readPixels();
      if (!after) return;
      const shape = findClosedShape(
        pixels,
        after,
        canvas.width,
        canvas.height,
        stroke,
        FILL_TOLERANCE,
      );
      if (shape) deps.onShapeClosed?.(shape);
    });
  };

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  return () => {
    canvas.removeEventListener('pointerdown', onDown);
    canvas.removeEventListener('pointermove', onMove);
    canvas.removeEventListener('pointerup', onUp);
    canvas.removeEventListener('pointercancel', onUp);
  };
}
