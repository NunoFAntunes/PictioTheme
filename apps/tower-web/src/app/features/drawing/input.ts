import { createPointerGate, pointPressure, type StrokeModel } from '@pictiotheme/canvas-engine';
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '@pictiotheme/protocol';
import { ERASER_SIZE, type DrawSettings } from './tools';

/**
 * Pointer input → stroke operations, applied straight to the stroke model. Plain TypeScript, no
 * React: strokes never go through React state. Points are in the fixed 1200×900 logical canvas
 * whatever size the canvas is on screen. One pointer draws at a time and palms are rejected once
 * a pen is seen (the shared pointer gate).
 */

const MIN_DISTANCE = 1.5;

export type DrawingInputDeps = {
  model: StrokeModel;
  getSettings(): DrawSettings;
  isEnabled(): boolean;
};

let strokeCounter = 0;

export function attachDrawingInput(canvas: HTMLCanvasElement, deps: DrawingInputDeps): () => void {
  const gate = createPointerGate();
  let strokeId: string | null = null;
  let last: { x: number; y: number } | null = null;

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
    strokeCounter += 1;
    strokeId = `t${strokeCounter}`;
    last = { x, y };
    deps.model.apply({
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

  const onMove = (e: PointerEvent) => {
    gate.observe(e);
    if (!strokeId || !gate.owns(e)) return;
    const pts: number[] = [];
    for (const event of e.getCoalescedEvents?.() ?? [e]) {
      const p = toLogical(event);
      if (last && Math.hypot(p.x - last.x, p.y - last.y) < MIN_DISTANCE) continue;
      pts.push(p.x, p.y, pointPressure(event));
      last = p;
    }
    if (pts.length) deps.model.apply({ t: 'draw:pts', id: strokeId, pts });
  };

  const onUp = (e: PointerEvent) => {
    if (!strokeId || !gate.owns(e)) return;
    deps.model.apply({ t: 'draw:end', id: strokeId });
    strokeId = null;
    last = null;
    gate.release();
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
