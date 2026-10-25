import type { ReactNode } from 'react';
import { previousColor, PALETTE_GROUPS, type Swatch, type ToolSettings } from '../tools';
import { Keycap } from './ToolbarParts';

const CHECKER = 'repeating-conic-gradient(#d4d4d8 0 25%, #fff 0 50%) 0 0 / 10px 10px';

/** `color` at `opacity` over a checkerboard, so a see-through colour looks see-through. */
function inkOverChecker(color: string, opacity: number): string {
  const alpha = Math.round(opacity * 255)
    .toString(16)
    .padStart(2, '0');
  return `linear-gradient(${color}${alpha}, ${color}${alpha}), ${CHECKER}`;
}

/**
 * The current colour, big, with the previous one tucked behind it (drawing-tools.md#toolbar).
 * The front chip opens the colour popover (`C`); the one behind swaps to it (`X`).
 */
export function InkWell({
  tool,
  onOpen,
  onSwap,
}: {
  tool: ToolSettings;
  onOpen: () => void;
  onSwap: () => void;
}) {
  const previous = previousColor(tool);
  return (
    <div className="relative size-16 shrink-0">
      {previous && (
        <button
          type="button"
          title={`Swap to the previous colour, ${previous} (X)`}
          aria-label={`Swap to previous colour ${previous}`}
          aria-keyshortcuts="X"
          onClick={onSwap}
          className="absolute right-0 bottom-0 size-8 rounded-lg border-2 border-white shadow-sm ring-1 ring-zinc-400 transition hover:scale-110 dark:border-zinc-900"
          style={{ backgroundColor: previous }}
        >
          <Keycap className="-right-2 -bottom-2">X</Keycap>
        </button>
      )}
      <button
        type="button"
        title={`Current colour ${tool.color}: click for the wheel and more colours (C)`}
        aria-label={`Current colour ${tool.color}. More colours`}
        aria-keyshortcuts="C"
        onClick={onOpen}
        className="absolute top-0 left-0 size-12 rounded-xl border-[3px] border-ink shadow-[2px_3px_0_var(--color-ink)] transition hover:-translate-y-0.5 hover:shadow-[3px_4px_0_var(--color-ink)] dark:border-zinc-100"
        style={{ background: inkOverChecker(tool.color, tool.opacity) }}
      >
        <span
          aria-hidden="true"
          className="absolute -top-1.5 -right-1.5 size-4 rounded-full border-2 border-white shadow-sm dark:border-zinc-900"
          style={{ background: 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)' }}
        />
        <Keycap className="-bottom-2 -left-2">C</Keycap>
      </button>
    </div>
  );
}

/**
 * The preset swatches as a hue grid: each column a colour over a darker one, in groups.
 * `wrapAt` reflows the columns into bands that many wide (the popover's narrow column).
 */
export function PaletteGrid({
  swatch,
  wrapAt,
  tight = false,
  fill = false,
}: {
  swatch: (s: Swatch) => ReactNode;
  wrapAt?: number;
  /** Closer swatches (the toolbar's single row); they stay apart on touch screens. */
  tight?: boolean;
  /** Bands stretch to the full width, their swatches sharing it. */
  fill?: boolean;
}) {
  const band = (columns: (readonly [Swatch, Swatch])[], key: string) => (
    <div
      key={key}
      className={`grid grid-flow-col grid-rows-2 ${fill ? 'w-full auto-cols-fr' : ''} ${tight ? 'gap-0.5 pointer-coarse:gap-1' : 'gap-1'}`}
    >
      {columns.flat().map(swatch)}
    </div>
  );
  if (wrapAt) {
    const columns = PALETTE_GROUPS.flatMap((g) => g.columns);
    const bands = [];
    for (let i = 0; i < columns.length; i += wrapAt)
      bands.push(band(columns.slice(i, i + wrapAt), String(i)));
    return <div className={`flex flex-col gap-1 ${fill ? 'w-full py-1' : ''}`}>{bands}</div>;
  }
  return (
    <div className={`flex items-center ${tight ? 'gap-1.5' : 'gap-2'}`}>
      {PALETTE_GROUPS.map((g) => band(g.columns, g.label))}
    </div>
  );
}
