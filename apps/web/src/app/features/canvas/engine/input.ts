import { MAX_POINTS_PER_MESSAGE } from '@pictiotheme/protocol';
import type { DrawOp } from '../../../realtime';
import type { ToolSettings } from '../tools';
import { adjustByDrag, lockAxis, type AdjustPatch, type Axis } from './adjust';
import type { BrushCursor } from './brush-cursor';
import { createPointerGate, pointPressure } from './pointer-gate';
import { sampleCanvas } from './sample';

/**
 * Turns pointer input into drawing operations (realtime-protocol.md#drawing-sync):
 * `draw:begin`, then `draw:pts` batches every ~33 ms, then `draw:end`.
 * Points closer than 1.5 logical px to the previous one are dropped.
 *
 * Right-button drag, or Ctrl/Cmd + drag, adjusts the brush instead of drawing
 * (drawing-tools.md#adjusting-size-and-opacity). A pen's barrel button reports as the right
 * button, so it works with a stylus too. Escape during the drag puts the settings back.
 *
 * The eyedropper (drawing-tools.md#picking-and-sampling-colours): hold Alt and click or drag to
 * sample, with the colour under the pointer previewed while Alt is held. A right-click (or
 * Ctrl/Cmd+click) that doesn't move far enough to start an adjust drag samples too. On touch,
 * where there's no Alt or right button, the toolbar's 💧 arms a pick: the next press samples.
 *
 * Tablets: one pointer draws at a time, a palm is rejected once a pen has been seen, and only a
 * pen's pressure is recorded (pointer-gate.ts).
 */

const FLUSH_MS = 33;
const MIN_DISTANCE = 1.5;
/** A right press released sooner than this, before the adjust drag picked an axis, samples. */
const TAP_MS = 300;

export type DrawingInputDeps = {
  /** Apply locally and send. */
  emit(op: DrawOp): void;
  getTool(): ToolSettings;
  setTool(patch: AdjustPatch): void;
  /** The eyedropper sampled a colour. */
  pickColor(color: string): void;
  isEnabled(): boolean;
  /** The toolbar's eyedropper is armed: a primary press samples instead of drawing. */
  isPicking?(): boolean;
  cursor: BrushCursor;
};

let strokeCounter = 0;
function newStrokeId(): string {
  strokeCounter += 1;
  return `${Date.now().toString(36)}${strokeCounter.toString(36)}`;
}

/** Right button (or a pen's barrel button), or a primary press with Ctrl/Cmd held. */
function isAdjustPress(e: PointerEvent): boolean {
  return e.button === 2 || (e.button === 0 && (e.ctrlKey || e.metaKey));
}

export function attachDrawingInput(canvas: HTMLCanvasElement, deps: DrawingInputDeps): () => void {
  let strokeId: string | null = null;
  let last: { x: number; y: number } | null = null;
  let pending: number[] = [];
  let flushTimer: ReturnType<typeof setInterval> | undefined;
  let adjust: {
    pointerId: number;
    x: number;
    y: number;
    start: ToolSettings;
    axis: Axis | null;
    at: number;
  } | null = null;
  let sampling: { pointerId: number } | null = null;
  let altHeld = false;
  const gate = createPointerGate();

  // The renderer sizes the canvas to its logical drawing size (the game board, or a cover).
  const toLogical = (e: { clientX: number; clientY: number }) => {
    const rect = canvas.getBoundingClientRect();
    const { width, height } = canvas;
    const x = ((e.clientX - rect.left) / rect.width) * width;
    const y = ((e.clientY - rect.top) / rect.height) * height;
    return {
      x: Math.round(Math.min(width, Math.max(0, x))),
      y: Math.round(Math.min(height, Math.max(0, y))),
    };
  };

  const flush = () => {
    if (!strokeId || pending.length === 0) return;
    deps.emit({ t: 'draw:pts', id: strokeId, pts: pending });
    pending = [];
  };

  const finish = () => {
    if (!strokeId) return;
    flush();
    deps.emit({ t: 'draw:end', id: strokeId });
    strokeId = null;
    last = null;
    clearInterval(flushTimer);
  };

  const sampleAt = (e: { clientX: number; clientY: number }) => {
    const p = toLogical(e);
    return sampleCanvas(canvas, p.x, p.y);
  };

  /** Alt is held over the canvas: preview the colour under the pointer. */
  const updatePreview = () => {
    const at = deps.cursor.pointerAt();
    const show = deps.isEnabled() && (altHeld || sampling !== null) && at && !strokeId && !adjust;
    deps.cursor.preview(show ? sampleAt({ clientX: at.x, clientY: at.y }) : null);
  };

  const endSampling = () => {
    if (!sampling) return;
    const { pointerId } = sampling;
    sampling = null;
    if (canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
    updatePreview();
  };

  const endAdjust = () => {
    if (!adjust) return;
    const { pointerId } = adjust;
    adjust = null;
    deps.cursor.unpin();
    if (canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
  };

  const end = () => {
    if (adjust) endAdjust();
    else if (sampling) endSampling();
    else finish();
    gate.release();
  };

  /** A cancelled or lost pointer ends what it was doing, but only if it was the one in charge. */
  const onCancel = (e: PointerEvent) => {
    if (gate.owns(e)) end();
  };

  const onUp = (e: PointerEvent) => {
    if (!gate.owns(e)) return;
    // A quick right-click that never became a drag samples where it was pressed.
    if (adjust && adjust.pointerId === e.pointerId && adjust.axis === null) {
      if (performance.now() - adjust.at < TAP_MS) {
        const color = sampleAt({ clientX: adjust.x, clientY: adjust.y });
        if (color) deps.pickColor(color);
      }
    }
    end();
  };

  const onDown = (e: PointerEvent) => {
    if (!deps.isEnabled() || strokeId || adjust || sampling) return;
    if (!gate.claim(e)) return;
    const picking = e.button === 0 && (deps.isPicking?.() ?? false);
    if (picking || (e.button === 0 && e.altKey && !e.ctrlKey && !e.metaKey)) {
      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      sampling = { pointerId: e.pointerId };
      const color = sampleAt(e);
      if (color) deps.pickColor(color);
      return;
    }
    if (isAdjustPress(e)) {
      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      adjust = {
        pointerId: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        start: deps.getTool(),
        axis: null,
        at: performance.now(),
      };
      deps.cursor.preview(null);
      deps.cursor.pin(e.clientX, e.clientY);
      return;
    }
    if (e.button !== 0) {
      gate.release();
      return;
    }
    e.preventDefault();
    const tool = deps.getTool();
    const p = toLogical(e);
    if (tool.tool === 'fill') {
      deps.emit({
        t: 'draw:fill',
        id: newStrokeId(),
        x: p.x,
        y: p.y,
        color: tool.color,
        tolerance: tool.fillTolerance,
      });
      gate.release();
      return;
    }
    canvas.setPointerCapture(e.pointerId);
    strokeId = newStrokeId();
    last = p;
    deps.emit({
      t: 'draw:begin',
      id: strokeId,
      tool: tool.tool,
      color: tool.color,
      size: tool.size,
      opacity: tool.opacity,
      x: p.x,
      y: p.y,
    });
    flushTimer = setInterval(flush, FLUSH_MS);
  };

  const onAdjustMove = (e: PointerEvent) => {
    if (!adjust || e.pointerId !== adjust.pointerId) return;
    const dx = e.clientX - adjust.x;
    const dy = e.clientY - adjust.y;
    adjust.axis = lockAxis(dx, dy, adjust.axis);
    const patch = adjustByDrag(adjust.start, adjust.axis, dx, dy);
    const current = deps.getTool();
    const changed = (Object.keys(patch) as (keyof AdjustPatch)[]).some(
      (k) => patch[k] !== current[k],
    );
    if (changed) deps.setTool(patch);
  };

  const onMove = (e: PointerEvent) => {
    gate.observe(e);
    // Tracked during the adjust drag too, so the ring lands under the pointer when it ends.
    if (e.pointerType !== 'touch') deps.cursor.hover(e.clientX, e.clientY);
    if (adjust) {
      onAdjustMove(e);
      return;
    }
    if (sampling) {
      if (e.pointerId !== sampling.pointerId) return;
      const color = sampleAt(e);
      if (color && color !== deps.getTool().color) deps.pickColor(color);
    }
    altHeld = e.altKey;
    if (!strokeId) updatePreview();
    if (!strokeId || !last || !gate.owns(e)) return;
    const events = e.getCoalescedEvents?.() ?? [e];
    for (const ev of events.length > 0 ? events : [e]) {
      const p = toLogical(ev);
      if (Math.hypot(p.x - last.x, p.y - last.y) < MIN_DISTANCE) continue;
      const pressure = pointPressure(ev);
      pending.push(p.x, p.y, Math.round(pressure * 100) / 100);
      last = p;
      if (pending.length >= MAX_POINTS_PER_MESSAGE * 3) flush();
    }
  };

  const onLeave = () => {
    deps.cursor.preview(null);
    deps.cursor.leave();
  };

  // Block the context menu so the right button can drag. On macOS it fires on press (also for
  // Ctrl+click), on Windows on release: blocking the event covers both.
  const onContextMenu = (e: MouseEvent) => {
    if (deps.isEnabled()) e.preventDefault();
  };

  // Alt alone would show Firefox's menu bar on Windows (on release) while it's the eyedropper.
  const onAlt = (e: KeyboardEvent) => {
    if (e.key !== 'Alt') return;
    if (deps.isEnabled() && deps.cursor.pointerAt()) e.preventDefault();
    altHeld = e.type === 'keydown';
    updatePreview();
  };

  const onBlur = () => {
    altHeld = false;
    updatePreview();
  };

  const onKey = (e: KeyboardEvent) => {
    onAlt(e);
    if (e.key !== 'Escape' || !adjust) return;
    const { size, opacity, fillTolerance } = adjust.start;
    deps.setTool({ size, opacity, fillTolerance });
    endAdjust();
  };

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onCancel);
  canvas.addEventListener('lostpointercapture', onCancel);
  canvas.addEventListener('pointerleave', onLeave);
  canvas.addEventListener('contextmenu', onContextMenu);
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onAlt);
  window.addEventListener('blur', onBlur);

  return () => {
    end();
    canvas.removeEventListener('pointerdown', onDown);
    canvas.removeEventListener('pointermove', onMove);
    canvas.removeEventListener('pointerup', onUp);
    canvas.removeEventListener('pointercancel', onCancel);
    canvas.removeEventListener('lostpointercapture', onCancel);
    canvas.removeEventListener('pointerleave', onLeave);
    canvas.removeEventListener('contextmenu', onContextMenu);
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('keyup', onAlt);
    window.removeEventListener('blur', onBlur);
  };
}
