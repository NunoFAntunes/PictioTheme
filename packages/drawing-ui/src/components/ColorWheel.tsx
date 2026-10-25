import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import {
  hexToHsv,
  hsvFor,
  hsvToHex,
  WHEEL_OFFSET as OFFSET,
  WHEEL_RING as RING,
  WHEEL_SIZE as SIZE,
  WHEEL_SQUARE as SQUARE,
  wheelPart,
  withWheelPart,
  type Hsv,
} from '../engine/color';

type Props = {
  value: string;
  /** Every change while dragging or using the arrow keys. */
  onChange: (color: string) => void;
  /** A hold is choosing a hue by direction: the square sits out, dimmed. */
  holding?: boolean;
};

const HUES = 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)';
const RING_MASK = `radial-gradient(farthest-side, transparent calc(100% - ${RING}px), #000 calc(100% - ${RING - 1}px))`;

type Drag = 'hue' | 'sv';

/**
 * Hue ring around a saturation/brightness square (drawing-tools.md#picking-and-sampling-colours).
 * Drag either part, or focus it and use the arrow keys (Shift for bigger steps). It keeps its own
 * HSV so the hue doesn't jump when dragging through greys or black.
 */
export function ColorWheel({ value, onChange, holding = false }: Props) {
  const [hsv, setHsv] = useState(() => hexToHsv(value));
  const [shown, setShown] = useState(value);
  // Follow colours set from outside (hex field, swatches), keeping the hue on greys.
  if (shown !== value) {
    setShown(value);
    if (hsvToHex(hsv) !== value) setHsv(hsvFor(value, hsv));
  }
  const drag = useRef<Drag | null>(null);
  const hueRef = useRef<HTMLDivElement>(null);
  const svRef = useRef<HTMLDivElement>(null);

  const set = (next: Hsv) => {
    const hex = hsvToHex(next);
    setHsv(next);
    setShown(hex);
    if (hex !== value) onChange(hex);
  };

  /** The part under the pointer; while dragging, clamped to the part the drag began on. */
  const apply = (e: PointerEvent<HTMLDivElement>, mode: Drag) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (mode === 'hue') {
      // Anywhere around the centre sets the hue, so the drag can leave the ring.
      const r = Math.hypot(x - SIZE / 2, y - SIZE / 2) || 1;
      const k = (SIZE / 2 - RING / 2) / r;
      const hit = wheelPart(SIZE / 2 + (x - SIZE / 2) * k, SIZE / 2 + (y - SIZE / 2) * k);
      if (hit?.part === 'hue') set(withWheelPart(hsv, hit));
      return;
    }
    const cx = Math.min(OFFSET + SQUARE, Math.max(OFFSET, x));
    const cy = Math.min(OFFSET + SQUARE, Math.max(OFFSET, y));
    const hit = wheelPart(cx, cy);
    if (hit) set(withWheelPart(hsv, hit));
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const mode = wheelPart(e.clientX - rect.left, e.clientY - rect.top)?.part;
    if (!mode) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    (mode === 'hue' ? hueRef : svRef).current?.focus({ preventScroll: true });
    drag.current = mode;
    apply(e, mode);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (drag.current) apply(e, drag.current);
  };

  const endDrag = () => {
    drag.current = null;
  };

  const onHueKey = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 10 : 1;
    const delta = { ArrowRight: step, ArrowUp: step, ArrowLeft: -step, ArrowDown: -step }[e.key];
    if (delta === undefined) return;
    e.preventDefault();
    e.stopPropagation();
    set({ ...hsv, h: (hsv.h + delta + 360) % 360 });
  };

  const onSvKey = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 0.1 : 0.01;
    const clamp = (n: number) => Math.min(1, Math.max(0, n));
    const patch: Partial<Hsv> | undefined = {
      ArrowRight: { s: clamp(hsv.s + step) },
      ArrowLeft: { s: clamp(hsv.s - step) },
      ArrowUp: { v: clamp(hsv.v + step) },
      ArrowDown: { v: clamp(hsv.v - step) },
    }[e.key];
    if (!patch) return;
    e.preventDefault();
    e.stopPropagation();
    set({ ...hsv, ...patch });
  };

  const hueRad = (hsv.h * Math.PI) / 180;
  const ringMid = SIZE / 2 - RING / 2;
  const marker =
    'pointer-events-none absolute size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgb(0_0_0/0.5)]';

  return (
    <div
      className="relative shrink-0 touch-none select-none"
      style={{ width: SIZE, height: SIZE }}
      data-testid="color-wheel"
      data-wheel
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onLostPointerCapture={endDrag}
    >
      <div
        ref={hueRef}
        role="slider"
        tabIndex={0}
        aria-label="Hue"
        aria-valuemin={0}
        aria-valuemax={359}
        aria-valuenow={Math.round(hsv.h)}
        aria-valuetext={`${Math.round(hsv.h)}°`}
        onKeyDown={onHueKey}
        className="absolute inset-0 cursor-pointer rounded-full outline-offset-2 focus-visible:outline-2 focus-visible:outline-brand-600"
        style={{ background: HUES, mask: RING_MASK }}
      />
      <span
        className={marker}
        style={{
          left: SIZE / 2 + Math.sin(hueRad) * ringMid,
          top: SIZE / 2 - Math.cos(hueRad) * ringMid,
          backgroundColor: hsvToHex({ h: hsv.h, s: 1, v: 1 }),
        }}
      />
      <div
        ref={svRef}
        role="slider"
        tabIndex={0}
        aria-label="Saturation and brightness"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(hsv.s * 100)}
        aria-valuetext={`Saturation ${Math.round(hsv.s * 100)}%, brightness ${Math.round(hsv.v * 100)}%`}
        onKeyDown={onSvKey}
        className={`absolute cursor-crosshair rounded-sm outline-offset-2 transition-opacity focus-visible:outline-2 focus-visible:outline-brand-600 ${holding ? 'opacity-30' : ''}`}
        style={{
          left: OFFSET,
          top: OFFSET,
          width: SQUARE,
          height: SQUARE,
          background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent), ${hsvToHex({ h: hsv.h, s: 1, v: 1 })}`,
        }}
      />
      <span
        className={`${marker} ${holding ? 'opacity-30' : ''}`}
        style={{
          left: OFFSET + hsv.s * SQUARE,
          top: OFFSET + (1 - hsv.v) * SQUARE,
          backgroundColor: shown,
        }}
      />
    </div>
  );
}
