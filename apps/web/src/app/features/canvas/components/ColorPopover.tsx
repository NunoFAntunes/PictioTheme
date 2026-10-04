import { useEffect, useLayoutEffect, useRef } from 'react';
import { PALETTE, type ToolSettings } from '../tools';
import { CustomColorInput } from './CustomColorInput';

type Props = {
  tool: ToolSettings;
  /** Where to open (client coordinates), or null for the middle of the board. */
  anchor: () => { x: number; y: number } | null;
  onLive: (color: string) => void;
  onPick: (color: string) => void;
  onClose: () => void;
};

const GAP = 8;

/**
 * Colours at the pointer, opened with `C` (drawing-tools.md#picking-and-sampling-colours):
 * the preset palette, the recent colours and the full picker. Picking a swatch closes it;
 * so do Esc, `C` again (handled by the toolbar) and a click anywhere else on the board.
 */
export function ColorPopover({ tool, anchor, onLive, onPick, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const anchorRef = useRef(anchor);

  // Open just below the pointer, kept wholly inside the board. Placed once, when it opens.
  useLayoutEffect(() => {
    const el = ref.current;
    const host = el?.parentElement;
    if (!el || !host) return;
    const rect = host.getBoundingClientRect();
    const at = anchorRef.current();
    const x = at ? at.x - rect.left : rect.width / 2;
    const y = at ? at.y - rect.top : rect.height / 3;
    const maxX = host.clientWidth - el.offsetWidth - GAP;
    const maxY = host.clientHeight - el.offsetHeight - GAP;
    el.style.left = `${Math.max(GAP, Math.min(x - el.offsetWidth / 2, maxX))}px`;
    el.style.top = `${Math.max(GAP, Math.min(y + GAP, maxY))}px`;
    el.style.visibility = 'visible';
  }, []);

  useEffect(() => {
    const current = ref.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]');
    (current ?? ref.current?.querySelector('button'))?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const recent = tool.recent.filter((c) => c !== tool.color).slice(0, 8);
  const swatch = (hex: string, label: string) => (
    <button
      key={hex}
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={tool.color === hex}
      onClick={() => onPick(hex)}
      className={`size-6 rounded border ${tool.color === hex ? 'ring-2 ring-brand-600 ring-offset-1' : 'border-zinc-300'}`}
      style={{ backgroundColor: hex }}
    />
  );

  return (
    <>
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
        className="absolute flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-2 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        style={{ visibility: 'hidden' }}
      >
        <div className="grid grid-cols-8 gap-1">{PALETTE.map((c) => swatch(c.hex, c.label))}</div>
        <div className="flex items-center gap-1">
          <span className="mr-1 text-xs text-zinc-500">Recent</span>
          {recent.length === 0 && <span className="text-xs text-zinc-400">none yet</span>}
          {recent.map((hex) => swatch(hex, `Recent ${hex}`))}
          <label className="ml-auto" title="Custom colour">
            <span className="sr-only">Custom colour</span>
            <CustomColorInput
              value={tool.color}
              onLive={onLive}
              onCommit={onPick}
              className="size-6 cursor-pointer"
            />
          </label>
        </div>
      </div>
    </>
  );
}
