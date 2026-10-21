import {
  createRenderer,
  pointPressure,
  type DrawOp,
  type StrokeModel,
} from '@pictiotheme/canvas-engine';
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '@pictiotheme/protocol';
import { useEffect, useRef, useState } from 'react';

/**
 * A small drawing pad for drawing yourself, for the portal and games without a drawing board of
 * their own: a few colours, two sizes, an eraser, undo and clear. Strokes go into `model` at the
 * shared 1200×900 logical size (canvas-engine renders them), so `drawingToAvatar` can cut the
 * doodle out.
 */

const COLORS = [
  { name: 'Black', hex: '#1f2330' },
  { name: 'Red', hex: '#e5484d' },
  { name: 'Orange', hex: '#f76b15' },
  { name: 'Yellow', hex: '#ffc53d' },
  { name: 'Green', hex: '#30a46c' },
  { name: 'Blue', hex: '#0090ff' },
  { name: 'Purple', hex: '#8e4ec6' },
  { name: 'Brown', hex: '#8d6e63' },
] as const;
const SIZES = [
  { name: 'Thin', px: 12 },
  { name: 'Thick', px: 32 },
] as const;

let nextId = 0;
const newId = () => `a${Date.now().toString(36)}${(nextId++).toString(36)}`;

export function DrawingPad({
  model,
  label = 'Drawing pad',
}: {
  model: StrokeModel;
  label?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [color, setColor] = useState<string>(COLORS[0].hex);
  const [size, setSize] = useState<number>(SIZES[0].px);
  const [eraser, setEraser] = useState(false);
  const [strokes, setStrokes] = useState(0);
  const tool = useRef({ color, size, eraser });
  useEffect(() => {
    tool.current = { color, size, eraser };
  });
  useEffect(() => model.subscribe(() => setStrokes(model.strokes.length)), [model]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const stopRenderer = createRenderer(canvas, model);
    let active: { pointerId: number; id: string } | null = null;

    const at = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: Math.round(((e.clientX - rect.left) / rect.width) * CANVAS_WIDTH),
        y: Math.round(((e.clientY - rect.top) / rect.height) * CANVAS_HEIGHT),
      };
    };
    const apply = (op: DrawOp) => model.apply(op);

    const down = (e: PointerEvent) => {
      if (active || e.button !== 0) return;
      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      const id = newId();
      active = { pointerId: e.pointerId, id };
      const { x, y } = at(e);
      const t = tool.current;
      apply({
        t: 'draw:begin',
        id,
        tool: t.eraser ? 'eraser' : 'brush',
        color: t.color,
        size: t.size,
        opacity: 1,
        x,
        y,
      });
      apply({ t: 'draw:pts', id, pts: [x, y, pointPressure(e)] });
    };
    const move = (e: PointerEvent) => {
      if (active?.pointerId !== e.pointerId) return;
      const pts: number[] = [];
      for (const ev of e.getCoalescedEvents?.() ?? [e]) {
        const { x, y } = at(ev);
        pts.push(x, y, pointPressure(ev));
      }
      apply({ t: 'draw:pts', id: active.id, pts });
    };
    const up = (e: PointerEvent) => {
      if (active?.pointerId !== e.pointerId) return;
      apply({ t: 'draw:end', id: active.id });
      active = null;
    };

    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    return () => {
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
      stopRenderer();
    };
  }, [model]);

  return (
    <div className="acct-pad">
      <canvas ref={canvasRef} aria-label={label} className="acct-pad-canvas" />
      <div className="acct-pad-tools" role="toolbar" aria-label="Drawing tools">
        <div className="acct-pad-group" role="group" aria-label="Colour">
          {COLORS.map(({ name, hex }) => (
            <button
              key={hex}
              type="button"
              aria-label={name}
              aria-pressed={!eraser && color === hex}
              title={name}
              className="acct-swatch"
              style={{ background: hex }}
              onClick={() => {
                setColor(hex);
                setEraser(false);
              }}
            />
          ))}
        </div>
        <div className="acct-pad-group" role="group" aria-label="Brush">
          {SIZES.map(({ name, px }) => (
            <button
              key={px}
              type="button"
              aria-pressed={size === px}
              className="acct-chip"
              onClick={() => setSize(px)}
            >
              {name}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={eraser}
            className="acct-chip"
            onClick={() => setEraser((e) => !e)}
          >
            Eraser
          </button>
        </div>
        <div className="acct-pad-group">
          <button
            type="button"
            className="acct-chip"
            disabled={strokes === 0}
            onClick={() => model.apply({ t: 'draw:undo' })}
          >
            Undo
          </button>
          <button
            type="button"
            className="acct-chip"
            disabled={strokes === 0}
            onClick={() => model.reset([])}
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}
