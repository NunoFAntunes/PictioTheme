import { useRef } from 'react';
import { useColorSlots } from '../color-slots';

/** A finger or pen held on a slot this long saves the current colour there. */
const LONG_PRESS_MS = 500;

/**
 * The five colour slots (drawing-tools.md#colour-slots), numbered like their keys. Click one to
 * use it; right-click or long-press saves the current colour there (`Shift` + its digit does too).
 */
export function ColorSlots({
  color,
  onUse,
  fill = false,
}: {
  /** The current colour, saved by a right-click or long-press. */
  color: string;
  onUse: (color: string) => void;
  /** Stretch to the space it's given (the toolbar's panel layout). */
  fill?: boolean;
}) {
  const slots = useColorSlots((s) => s.slots);
  const setSlot = useColorSlots((s) => s.setSlot);
  /** A finger or pen on a slot: `saved` once the long-press saved, so its click doesn't use it. */
  const press = useRef<{ timer?: ReturnType<typeof setTimeout>; saved: boolean } | null>(null);

  const endPress = () => clearTimeout(press.current?.timer);

  return (
    <div
      className={`flex items-center gap-1.5 rounded-xl bg-zinc-100 px-2 py-1 dark:bg-zinc-800/70 ${fill ? 'min-w-48 flex-1' : ''}`}
      role="group"
      aria-label="Colour slots"
    >
      {slots.map((slot, i) => (
        <button
          key={i}
          type="button"
          title={`Slot ${i + 1} (${i + 1}). Right-click, long-press or Shift+${i + 1} saves the current colour here`}
          aria-label={`Colour slot ${i + 1}`}
          aria-pressed={color === slot}
          onPointerDown={(e) => {
            endPress();
            press.current = null;
            if (e.pointerType === 'mouse') return;
            const current: { timer?: ReturnType<typeof setTimeout>; saved: boolean } = {
              saved: false,
            };
            current.timer = setTimeout(() => {
              current.saved = true;
              navigator.vibrate?.(10);
              setSlot(i, color);
            }, LONG_PRESS_MS);
            press.current = current;
          }}
          onPointerUp={endPress}
          onPointerLeave={endPress}
          onPointerCancel={endPress}
          onContextMenu={(e) => {
            e.preventDefault();
            // A long-press already saved it (Android also sends a context menu for one).
            if (!press.current?.saved) setSlot(i, color);
          }}
          onClick={() => {
            if (press.current?.saved) {
              press.current = null;
              return;
            }
            onUse(slot);
          }}
          className={`relative h-14 rounded-lg select-none [-webkit-touch-callout:none] ${fill ? 'flex-1' : 'w-9 pointer-coarse:w-11'} ${color === slot ? 'ring-2 ring-ink ring-offset-1 dark:ring-zinc-100 dark:ring-offset-zinc-900' : 'ring-1 ring-black/15 ring-inset'}`}
          style={{ backgroundColor: slot }}
        >
          <span
            aria-hidden="true"
            className="absolute -right-1 -bottom-1 grid size-3.5 place-items-center rounded-full bg-white text-[0.55rem] leading-none font-bold text-zinc-700 shadow-sm ring-1 ring-zinc-300 pointer-coarse:size-4 pointer-coarse:text-[0.65rem]"
          >
            {i + 1}
          </span>
        </button>
      ))}
    </div>
  );
}
