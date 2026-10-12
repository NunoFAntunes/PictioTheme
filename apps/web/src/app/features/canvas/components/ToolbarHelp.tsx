import { useEffect, useId, useRef, useState } from 'react';
import { ALT, MOD } from '../shortcut-hints';

type Row = { keys: string[]; label: string };

/** Gestures with no button of their own. The buttons' keys are on their keycaps. */
const MOUSE_ROWS: Row[] = [
  { keys: ['Right-drag', `${MOD}-drag`], label: '↔ size, ↕ opacity (Fill: tolerance)' },
  { keys: [`${ALT}+click`, 'Right-click'], label: 'Pick up a colour from the drawing' },
  { keys: ['Hold C', 'Middle button'], label: 'Colour wheel: let go over a colour' },
  { keys: ['Shift+1–5'], label: 'Save the colour to a slot (or right-click it)' },
  { keys: ['Shift+[ ]'], label: 'Halve or double the size' },
  { keys: ['Esc'], label: 'Cancel a size or opacity drag' },
];

const TOUCH_ROWS: Row[] = [
  { keys: ['Long-press'], label: 'Colour wheel under your finger: slide onto a colour' },
  { keys: ['Long-press a slot'], label: 'Save the colour to it' },
  { keys: ['Dropper'], label: 'Then tap the drawing to pick up a colour' },
];

function Rows({ rows, className }: { rows: Row[]; className: string }) {
  return (
    <ul className={`space-y-1.5 ${className}`}>
      {rows.map((row) => (
        <li key={row.label} className="flex items-baseline gap-2">
          <span className="flex shrink-0 flex-wrap items-center gap-1">
            {row.keys.map((k) => (
              <kbd
                key={k}
                className="rounded border border-zinc-300 bg-white px-1.5 py-0.5 font-sans text-[11px] leading-none text-zinc-700 shadow-[0_1px_0_0] shadow-zinc-300 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:shadow-zinc-700"
              >
                {k}
              </kbd>
            ))}
          </span>
          <span>{row.label}</span>
        </li>
      ))}
    </ul>
  );
}

/** "?": the canvas gestures, in a small card over the toolbar. Esc or a click elsewhere closes it. */
export function ToolbarHelp() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        title="Drawing tips"
        aria-label="Drawing tips"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className={`grid size-7 place-items-center rounded-lg font-logo text-base pointer-coarse:size-11 ${open ? 'bg-ink text-white dark:bg-zinc-100 dark:text-ink' : 'hover:bg-white dark:hover:bg-zinc-700'}`}
      >
        ?
      </button>
      {open && (
        <div
          id={id}
          role="region"
          aria-label="Drawing tips"
          className="absolute right-0 bottom-full z-30 mb-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-zinc-200 bg-white p-3 text-xs text-zinc-700 shadow-lg dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
        >
          <h3 className="mb-2 font-semibold">On the canvas</h3>
          <Rows rows={MOUSE_ROWS} className="pointer-coarse:hidden" />
          <Rows rows={TOUCH_ROWS} className="hidden pointer-coarse:block" />
          <p className="mt-2 text-zinc-500 pointer-coarse:hidden dark:text-zinc-400">
            Every button shows its key. ⌨ hides them.
          </p>
        </div>
      )}
    </div>
  );
}
