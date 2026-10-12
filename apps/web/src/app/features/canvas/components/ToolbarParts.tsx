import type { ReactNode } from 'react';
import { useShortcutHints } from '../shortcut-hints';

/** One of the toolbar's groups (tools, brush, colour, …): a tray, so it reads as one thing. */
export function Zone({
  label,
  children,
  className = '',
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={`flex items-center gap-1 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800/70 ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * The key for a control, as a little keycap on its corner. Hidden while the player has hidden
 * them (⌨), and on touch screens. Decorative: the control has `aria-keyshortcuts` and a title.
 */
export function Keycap({
  children,
  className = '-right-1.5 -bottom-1.5',
  inline = false,
}: {
  children: ReactNode;
  /** Where it sits on the control (the bottom-right corner by default). */
  className?: string;
  /** In the text flow (beside a caption) rather than on a corner. */
  inline?: boolean;
}) {
  const shown = useShortcutHints((s) => s.shown);
  if (!shown) return null;
  return (
    <kbd
      aria-hidden="true"
      className={`pointer-events-none min-w-4 ${inline ? 'ml-1 inline-block' : `absolute z-10 ${className}`} rounded border border-zinc-300 bg-white px-1 text-center font-sans text-[10px] leading-3.5 font-semibold whitespace-nowrap text-zinc-600 shadow-[0_1px_0_0] shadow-zinc-300 pointer-coarse:hidden dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:shadow-zinc-700`}
    >
      {children}
    </kbd>
  );
}

// Spelled out in full: Tailwind only finds class names written literally.
const RANGE = [
  'h-2.5 cursor-pointer appearance-none rounded-full ring-1 ring-zinc-300 ring-inset dark:ring-zinc-600',
  'focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-600',
  '[&::-webkit-slider-runnable-track]:h-2.5 [&::-webkit-slider-runnable-track]:bg-transparent',
  '[&::-webkit-slider-thumb]:-mt-1 [&::-webkit-slider-thumb]:box-border [&::-webkit-slider-thumb]:size-[18px] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-[3px] [&::-webkit-slider-thumb]:border-ink [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[1px_2px_0_var(--color-ink)]',
  '[&::-moz-range-track]:bg-transparent',
  '[&::-moz-range-thumb]:box-border [&::-moz-range-thumb]:size-[18px] [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-[3px] [&::-moz-range-thumb]:border-ink [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:shadow-[1px_2px_0_var(--color-ink)]',
  // Finger-sized thumbs on touch screens (rule W15).
  'pointer-coarse:[&::-webkit-slider-thumb]:size-[26px] pointer-coarse:[&::-webkit-slider-thumb]:-mt-2 pointer-coarse:[&::-moz-range-thumb]:size-[26px]',
].join(' ');

/** Sliders stacked in one grid, so their captions, tracks and values line up. */
export function SliderStack({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-[auto_auto_auto] items-center gap-x-2 gap-y-4 px-1.5">
      {children}
    </div>
  );
}

/** One line of a `SliderStack`: caption, a track that shows what it does, the value. */
export function Slider({
  label,
  ariaLabel = label,
  value,
  min,
  max,
  step,
  display,
  track,
  hint,
  keys,
  onChange,
}: {
  /** The caption before the track. */
  label: string;
  ariaLabel?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  /** The value as shown, with its unit. */
  display: string;
  /** CSS `background` for the track. */
  track: string;
  hint?: string;
  /** Its keyboard shortcut, as a keycap. */
  keys?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="contents">
      <span
        title={hint}
        className="flex items-center text-[11px] leading-none font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400"
      >
        {label}
        {keys && <Keycap inline>{keys}</Keycap>}
      </span>
      <input
        title={hint}
        type="range"
        aria-label={ariaLabel}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`${RANGE} w-24 pointer-coarse:w-32`}
        style={{ background: track }}
      />
      <span className="w-11 text-right text-[11px] leading-none font-semibold text-zinc-700 tabular-nums dark:text-zinc-200">
        {display}
      </span>
    </label>
  );
}
