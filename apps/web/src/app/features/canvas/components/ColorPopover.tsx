import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { hexToHsv, holdColor, holdHue, parseHex, shadesOf } from '../engine/color';
import { PALETTE, RECENT_COLORS, type ToolSettings } from '../tools';
import type { ColorHold } from '../use-color-popover';
import { ColorWheel } from './ColorWheel';
import { CustomColorInput } from './CustomColorInput';

type Props = {
  tool: ToolSettings;
  /** Where to open (client coordinates), or null for the middle of the board. */
  anchor: () => { x: number; y: number } | null;
  /** The button, finger or key that opened it, while it's still held down. */
  hold: ColorHold | null;
  onLive: (color: string) => void;
  /** A colour was picked: it joins the recent colours and the popover closes. */
  onPick: (color: string) => void;
  onClose: () => void;
};

const GAP = 8;
/** A held pointer that moves less than this (px) was a click or a tap: the popover stays open. */
const HOLD_SLOP = 10;
const SHADE_NAMES = ['Darkest', 'Darker', 'Dark', 'Current', 'Light', 'Lighter', 'Lightest'];

/** The browser's screen eyedropper (Chromium only). */
type EyeDropperApi = new () => { open(): Promise<{ sRGBHex: string }> };
const EyeDropper =
  typeof window === 'undefined'
    ? undefined
    : (window as unknown as { EyeDropper?: EyeDropperApi }).EyeDropper;

/**
 * Colours at the pointer (drawing-tools.md#picking-and-sampling-colours), opened with `C`, a
 * middle-click, a long-press or the toolbar's wheel. The wheel is centred on the pointer with the
 * recent colours around it, then a hex field, the shades of the current colour and the palette.
 *
 * A swatch, Enter in the hex field, the screen eyedropper or the system picker closing picks and
 * closes. The wheel previews live and its colour is kept when the popover closes any other way
 * (`C`, a click elsewhere, the turn ending), except `Esc`, which puts the colour back.
 *
 * Held open (the middle button, `C` or a long-press still down): what's under the pointer
 * previews, and letting go over it picks it. Over the wheel that's a hue, by direction from its
 * centre (the square sits out, dimmed); a recent colour, shade or swatch is that colour. Letting
 * go elsewhere closes it unchanged. Letting go without moving leaves it open, as a click would.
 */
export function ColorPopover({ tool, anchor, hold, onLive, onPick, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef(anchor);
  const [opened] = useState(tool.color);
  /** A colour previewed (wheel, hex field, system picker, hold) and not picked yet. */
  const pending = useRef<string | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [holding, setHolding] = useState(hold !== null);

  // The wheel centred where it opened, kept wholly inside the board. Placed once.
  useLayoutEffect(() => {
    const el = ref.current;
    const host = el?.parentElement;
    const ring = ringRef.current;
    if (!el || !host || !ring) return;
    const rect = host.getBoundingClientRect();
    const at = anchorRef.current();
    const x = at
      ? at.x - rect.left - ring.offsetLeft - ring.offsetWidth / 2
      : (rect.width - el.offsetWidth) / 2;
    const y = at
      ? at.y - rect.top - ring.offsetTop - ring.offsetHeight / 2
      : (rect.height - el.offsetHeight) / 2;
    const maxX = host.clientWidth - el.offsetWidth - GAP;
    const maxY = host.clientHeight - el.offsetHeight - GAP;
    el.style.left = `${Math.max(GAP, Math.min(x, maxX))}px`;
    el.style.top = `${Math.max(GAP, Math.min(y, maxY))}px`;
    el.style.visibility = 'visible';
  }, []);

  useEffect(() => {
    const current = ref.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]');
    (current ?? ref.current?.querySelector('button'))?.focus({ preventScroll: true });
  }, []);

  // Closed with a colour still previewed: keep it, as if it had been picked.
  const onPickRef = useRef(onPick);
  const onLiveRef = useRef(onLive);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onPickRef.current = onPick;
    onLiveRef.current = onLive;
    onCloseRef.current = onClose;
  });
  useEffect(
    () => () => {
      if (pending.current) onPickRef.current(pending.current);
    },
    [],
  );

  const preview = (color: string) => {
    pending.current = color;
    onLiveRef.current(color);
  };

  const revert = () => {
    if (!pending.current) return;
    pending.current = null;
    onLiveRef.current(opened);
  };

  const pick = (color: string) => {
    pending.current = null;
    onPickRef.current(color);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      revert();
      onCloseRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- revert only reads refs and `opened`
  }, []);

  // The hold: preview what's under the pointer, pick it on release. Attached before paint, so a
  // quick click's release isn't missed.
  useLayoutEffect(() => {
    if (!hold) return;
    const base = hexToHsv(opened);
    let start = anchorRef.current();
    let moved = false;
    let over: string | null = null;
    let active = true;

    const colorAt = (x: number, y: number): string | null => {
      const el = document.elementFromPoint(x, y);
      if (!el || !ref.current?.contains(el)) return null;
      const swatch = el.closest<HTMLElement>('[data-color]');
      if (swatch?.dataset.color) return swatch.dataset.color;
      const wheel = ref.current.querySelector('[data-wheel]');
      if (!wheel) return null;
      const box = wheel.getBoundingClientRect();
      const h = holdHue(x - box.left - box.width / 2, y - box.top - box.height / 2);
      return h === null ? null : holdColor(base, h);
    };

    const finish = (released: boolean) => {
      if (!active) return;
      active = false;
      setHolding(false);
      if (!moved) return; // a click or a tap: stays open
      if (released && over) {
        pick(over);
        return;
      }
      revert();
      if (released) onCloseRef.current();
    };

    const isHolder = (e: PointerEvent) => hold !== 'key' && e.pointerId === hold.pointerId;

    const onMove = (e: PointerEvent) => {
      if (!active) return;
      if (hold !== 'key') {
        if (!isHolder(e)) return;
        if (e.buttons === 0) {
          finish(true); // released somewhere we didn't hear about
          return;
        }
      }
      start ??= { x: e.clientX, y: e.clientY };
      if (!moved && Math.hypot(e.clientX - start.x, e.clientY - start.y) < HOLD_SLOP) return;
      moved = true;
      over = colorAt(e.clientX, e.clientY);
      if (over) {
        if (over !== pending.current) preview(over);
      } else {
        revert();
      }
    };
    const onUp = (e: PointerEvent) => {
      if (isHolder(e)) finish(true);
    };
    const onCancel = (e: PointerEvent) => {
      if (isHolder(e)) finish(false);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (hold === 'key' && e.code === 'KeyC') finish(true);
    };
    const onBlur = () => finish(false);

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      active = false;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the hold is fixed while it's open
  }, []);

  const swatchClass = (pressed: boolean) =>
    `size-5 rounded border pointer-coarse:size-9 ${pressed ? 'ring-2 ring-brand-600 ring-offset-1' : 'border-zinc-300'}`;
  const swatch = (hex: string, label: string, pressed = tool.color === hex) => (
    <button
      key={label}
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={pressed}
      data-color={hex}
      onClick={() => pick(hex)}
      className={swatchClass(pressed)}
      style={{ backgroundColor: hex }}
    />
  );

  // During a hold the shades stay put, so they don't shift under the pointer as it previews them.
  const shades = shadesOf(holding ? opened : tool.color);
  const recent = tool.recent.filter((c) => c !== opened).slice(0, RECENT_COLORS);

  return (
    // Its own box over the board, so the layout can follow the board's width (a container).
    <div className="absolute inset-0 @container">
      <div
        className="absolute inset-0"
        data-testid="color-popover-backdrop"
        onPointerDown={(e) => {
          e.preventDefault();
          onClose();
        }}
      />
      <div
        ref={ref}
        role="dialog"
        aria-label="Colours"
        onPointerDown={(e) => {
          // Another middle-click closes it, wherever it lands.
          if (e.button !== 1) return;
          e.preventDefault();
          onClose();
        }}
        className="absolute flex max-h-[calc(100%-16px)] flex-col items-center gap-2 overflow-y-auto overscroll-contain rounded-xl border border-zinc-200 bg-white p-2 shadow-lg @lg:flex-row @lg:items-start dark:border-zinc-700 dark:bg-zinc-900"
        style={{ visibility: 'hidden' }}
      >
        {/* The wheel with the recent colours on a ring around it. */}
        <div
          ref={ringRef}
          className="relative flex shrink-0 items-center justify-center [--dot:20px] pointer-coarse:[--dot:28px]"
          style={{ width: 'calc(168px + 2 * var(--dot))', height: 'calc(168px + 2 * var(--dot))' }}
        >
          <ColorWheel value={tool.color} onChange={preview} holding={holding} />
          {Array.from({ length: RECENT_COLORS }, (_, i) => {
            const hex = recent[i];
            const angle = (i * 2 * Math.PI) / RECENT_COLORS;
            const place = {
              left: `calc(50% + ${Math.sin(angle).toFixed(4)} * (84px + var(--dot) / 2))`,
              top: `calc(50% - ${Math.cos(angle).toFixed(4)} * (84px + var(--dot) / 2))`,
            };
            const dot =
              'absolute size-(--dot) -translate-x-1/2 -translate-y-1/2 rounded-full border';
            return hex ? (
              <button
                key={i}
                type="button"
                title={`Recent ${hex}`}
                aria-label={`Recent ${hex}`}
                aria-pressed={tool.color === hex}
                data-color={hex}
                onClick={() => pick(hex)}
                className={`${dot} ${tool.color === hex ? 'ring-2 ring-brand-600 ring-offset-1' : 'border-zinc-300'}`}
                style={{ ...place, backgroundColor: hex }}
              />
            ) : (
              <span
                key={i}
                aria-hidden="true"
                className={`${dot} border-dashed border-zinc-300 dark:border-zinc-600`}
                style={place}
              />
            );
          })}
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1">
            <input
              type="text"
              aria-label="Hex colour"
              title="Type a hex colour, Enter to pick it"
              spellCheck={false}
              maxLength={7}
              value={draft ?? tool.color}
              onChange={(e) => {
                setDraft(e.target.value);
                const hex = parseHex(e.target.value);
                if (hex && hex !== tool.color) preview(hex);
              }}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return;
                const hex = parseHex(e.currentTarget.value);
                if (hex) pick(hex);
              }}
              onBlur={() => setDraft(null)}
              className="h-6 w-20 rounded border border-zinc-300 bg-transparent px-1 font-mono text-xs pointer-coarse:h-9 pointer-coarse:w-24 pointer-coarse:text-sm dark:border-zinc-600"
            />
            {EyeDropper && (
              <button
                type="button"
                title="Pick up a colour from anywhere on screen"
                aria-label="Pick up a colour from the screen"
                onClick={() => {
                  new EyeDropper()
                    .open()
                    .then(({ sRGBHex }) => {
                      const hex = parseHex(sRGBHex);
                      if (hex) pick(hex);
                    })
                    .catch(() => {}); // cancelled with Esc
                }}
                className="flex size-6 items-center justify-center rounded text-sm hover:bg-zinc-200 pointer-coarse:size-9 dark:hover:bg-zinc-800"
              >
                💧
              </button>
            )}
            <label title="System colour picker" className="flex">
              <span className="sr-only">System colour picker</span>
              <CustomColorInput
                value={tool.color}
                onLive={preview}
                onCommit={pick}
                className="size-6 cursor-pointer pointer-coarse:size-9"
              />
            </label>
          </div>
          <div className="flex gap-1" role="group" aria-label="Shades">
            {shades.map((hex, i) =>
              swatch(hex, `${SHADE_NAMES[i] ?? 'Shade'} ${hex}`, i === 3 && tool.color === hex),
            )}
          </div>
          <div className="grid grid-cols-8 gap-1">{PALETTE.map((c) => swatch(c.hex, c.label))}</div>
        </div>
      </div>
    </div>
  );
}
