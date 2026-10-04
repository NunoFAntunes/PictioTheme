import { useEffect, useRef, useState, type RefObject } from 'react';
import { createStrokeModel, type DrawOp } from '../../../realtime';
import { createRenderer } from '../engine/renderer';
import { PALETTE } from '../tools';

/**
 * A small local canvas for drawings that aren't part of a turn: avatars and deck covers. It reuses
 * the game's stroke model and renderer, with a reduced toolbar. Nothing is sent anywhere: the
 * owner exports the canvas when it's done (e.g. avatar-image.ts).
 */

const MIN_DISTANCE = 1.5;

type PadTool = 'brush' | 'eraser' | 'fill';

const TOOLS: { tool: PadTool; label: string; icon: string }[] = [
  { tool: 'brush', label: 'Brush', icon: '✏️' },
  { tool: 'eraser', label: 'Eraser', icon: '🧽' },
  { tool: 'fill', label: 'Fill', icon: '🪣' },
];

const SIZES = [
  { label: 'Thin', size: 8 },
  { label: 'Medium', size: 20 },
  { label: 'Thick', size: 44 },
] as const;

const COLOURS = [
  'Black',
  'White',
  'Red',
  'Orange',
  'Yellow',
  'Green',
  'Cyan',
  'Blue',
  'Violet',
  'Pink',
  'Brown',
  'Skin light',
  'Skin medium',
  'Skin tan',
  'Skin dark',
].flatMap((label) => PALETTE.filter((c) => c.label === label));

let opCounter = 0;
const newOpId = () => `sketch-${(opCounter += 1)}`;

/** True when nothing visible has been drawn (also after "start over"). */
export function isBlank(source: HTMLCanvasElement): boolean {
  const ctx = source.getContext('2d');
  if (!ctx) return true;
  const { data } = ctx.getImageData(0, 0, source.width, source.height);
  for (let i = 3; i < data.length; i += 4) if (data[i] !== 0) return false;
  return true;
}

export function SketchPad({
  canvasRef,
  name,
  width,
  height,
  className,
}: {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  /** Labels the canvas ("<name> drawing pad") and its toolbar ("<name> tools"). */
  name: string;
  /** The drawing's own coordinates. The canvas is scaled to `className`'s size on screen. */
  width: number;
  height: number;
  /** Size and aspect ratio of the canvas on screen. */
  className: string;
}) {
  const [model] = useState(createStrokeModel);
  const [tool, setTool] = useState<PadTool>('brush');
  const [color, setColor] = useState('#000000');
  const [size, setSize] = useState<number>(SIZES[1].size);
  const settings = useRef({ tool, color, size });
  useEffect(() => {
    settings.current = { tool, color, size };
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const stopRenderer = createRenderer(canvas, model, { width, height });
    let strokeId: string | null = null;
    let last = { x: 0, y: 0 };

    const toPad = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const clamp = (v: number, max: number) => Math.round(Math.min(max, Math.max(0, v)));
      return {
        x: clamp(((e.clientX - rect.left) / rect.width) * width, width),
        y: clamp(((e.clientY - rect.top) / rect.height) * height, height),
      };
    };
    const apply = (op: DrawOp) => model.apply(op);

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 || strokeId) return;
      e.preventDefault();
      const p = toPad(e);
      const s = settings.current;
      if (s.tool === 'fill') {
        apply({ t: 'draw:fill', id: newOpId(), ...p, color: s.color, tolerance: 32 });
        return;
      }
      canvas.setPointerCapture(e.pointerId);
      strokeId = newOpId();
      last = p;
      apply({
        t: 'draw:begin',
        id: strokeId,
        tool: s.tool,
        color: s.color,
        size: s.size,
        opacity: 1,
        ...p,
      });
    };
    const onMove = (e: PointerEvent) => {
      if (!strokeId) return;
      const pts: number[] = [];
      for (const ev of e.getCoalescedEvents?.() ?? [e]) {
        const p = toPad(ev);
        if (Math.hypot(p.x - last.x, p.y - last.y) < MIN_DISTANCE) continue;
        pts.push(p.x, p.y, ev.pointerType === 'mouse' || !ev.pressure ? 0.5 : ev.pressure);
        last = p;
      }
      if (pts.length > 0) apply({ t: 'draw:pts', id: strokeId, pts });
    };
    const onUp = () => {
      if (!strokeId) return;
      apply({ t: 'draw:end', id: strokeId });
      strokeId = null;
    };

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('lostpointercapture', onUp);
    return () => {
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('lostpointercapture', onUp);
      stopRenderer();
    };
  }, [canvasRef, model, width, height]);

  const button = (active: boolean) =>
    `rounded-md px-2 py-1 text-sm ${active ? 'bg-brand-600 text-white' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'}`;

  return (
    <div className="flex flex-col items-center gap-2">
      <canvas
        ref={canvasRef}
        aria-label={`${name} drawing pad`}
        className={`${className} touch-none rounded-2xl border border-zinc-300 bg-white shadow-sm dark:border-zinc-700 ${tool === 'fill' ? 'cursor-cell' : 'cursor-crosshair'}`}
      />
      <div
        className="flex flex-wrap items-center justify-center gap-1"
        role="toolbar"
        aria-label={`${name} tools`}
      >
        {TOOLS.map((t) => (
          <button
            key={t.tool}
            type="button"
            title={t.label}
            aria-label={t.label}
            aria-pressed={tool === t.tool}
            onClick={() => setTool(t.tool)}
            className={button(tool === t.tool)}
          >
            {t.icon}
          </button>
        ))}
        <span className="mx-1 h-5 w-px bg-zinc-200 dark:bg-zinc-700" aria-hidden="true" />
        {SIZES.map((s) => (
          <button
            key={s.size}
            type="button"
            title={s.label}
            aria-label={`${s.label} brush`}
            aria-pressed={size === s.size}
            onClick={() => setSize(s.size)}
            className={`${button(size === s.size)} flex size-8 items-center justify-center`}
          >
            <span
              className="rounded-full bg-current"
              style={{ width: 4 + s.size / 4, height: 4 + s.size / 4 }}
            />
          </button>
        ))}
        <span className="mx-1 h-5 w-px bg-zinc-200 dark:bg-zinc-700" aria-hidden="true" />
        <button
          type="button"
          title="Undo"
          aria-label="Undo"
          onClick={() => model.apply({ t: 'draw:undo' })}
          className={button(false)}
        >
          ↶
        </button>
        <button
          type="button"
          title="Start over"
          aria-label="Start over"
          onClick={() => model.reset([])}
          className={button(false)}
        >
          🗑
        </button>
      </div>
      <div className="flex flex-wrap justify-center gap-1" aria-label="Colours">
        {COLOURS.map((c) => (
          <button
            key={c.hex}
            type="button"
            title={c.label}
            aria-label={c.label}
            aria-pressed={color === c.hex}
            onClick={() => {
              setColor(c.hex);
              if (tool === 'eraser') setTool('brush');
            }}
            className={`size-6 rounded-md border ${color === c.hex ? 'ring-2 ring-brand-600 ring-offset-1' : 'border-zinc-300'}`}
            style={{ backgroundColor: c.hex }}
          />
        ))}
        <label title="Custom colour" className="flex">
          <span className="sr-only">Custom colour</span>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="size-6 cursor-pointer"
          />
        </label>
      </div>
    </div>
  );
}
