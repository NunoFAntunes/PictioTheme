import { MAX_BRUSH_SIZE, MAX_FILL_TOLERANCE, MIN_BRUSH_SIZE } from '@pictiotheme/protocol';
import { useEffect } from 'react';
import { drawAndSend, type DrawOp } from '../../../realtime';
import { applyShortcut, shortcutFor } from '../shortcuts';
import { PALETTE, SIZE_PRESETS, withColor, type Tool, type ToolSettings } from '../tools';
import { CustomColorInput } from './CustomColorInput';

type Props = {
  tool: ToolSettings;
  onChange: (next: ToolSettings) => void;
  /** `C`: open or close the colour popover on the canvas. */
  onToggleColorPopover: () => void;
  /** Where undo/redo/clear go. Defaults to the room; a cover pad applies them locally. */
  emit?: (op: DrawOp) => void;
  /** Labels the toolbar. */
  label?: string;
  /** The 💧 eyedropper is armed (the way to pick up a colour on touch, without Alt). */
  picking?: boolean;
  onTogglePicking?: () => void;
};

const TOOLS: { tool: Tool; label: string; icon: string; key: string }[] = [
  { tool: 'brush', label: 'Brush', icon: '✏️', key: 'b' },
  { tool: 'eraser', label: 'Eraser', icon: '🧽', key: 'e' },
  { tool: 'fill', label: 'Fill', icon: '🪣', key: 'f' },
];

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent);
const DRAG_HINT = `Right-drag or ${IS_MAC ? '⌘' : 'Ctrl'}-drag on the canvas: ↔ size, ↕ opacity`;
const COLOR_HINT = `${IS_MAC ? '⌥' : 'Alt'}+click or right-click the canvas to pick up a colour. X swaps to the last colour, C opens colours at the pointer`;

function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  );
}

/** Drawer-only tools. Shortcuts: docs/product/drawing-tools.md#keyboard-shortcuts. */
export function Toolbar({
  tool,
  onChange,
  onToggleColorPopover,
  emit = drawAndSend,
  label = 'Drawing tools',
  picking = false,
  onTogglePicking,
}: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      const shortcut = shortcutFor(e);
      if (!shortcut) return;
      e.preventDefault();
      if (shortcut.kind === 'undo' || shortcut.kind === 'redo') {
        emit({ t: shortcut.kind === 'redo' ? 'draw:redo' : 'draw:undo' });
        return;
      }
      if (shortcut.kind === 'color-popover') {
        onToggleColorPopover();
        return;
      }
      onChange(applyShortcut(tool, shortcut));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tool, onChange, onToggleColorPopover, emit]);

  // Touch screens get finger-sized targets (44 px, rule W15); mouse users keep the compact bar.
  const button = (active: boolean) =>
    `rounded-md px-2 py-1 text-sm pointer-coarse:min-h-11 pointer-coarse:min-w-11 pointer-coarse:px-3 ${active ? 'bg-brand-600 text-white' : 'hover:bg-zinc-200 dark:hover:bg-zinc-800'}`;

  return (
    <div
      className="flex max-w-full min-w-0 flex-wrap items-center gap-3 rounded-xl border border-zinc-200 p-2 dark:border-zinc-800"
      role="toolbar"
      aria-label={label}
    >
      <div className="flex flex-wrap gap-1">
        {TOOLS.map((t) => (
          <button
            key={t.tool}
            type="button"
            title={`${t.label} (${t.key.toUpperCase()})`}
            aria-pressed={tool.tool === t.tool}
            onClick={() => onChange({ ...tool, tool: t.tool })}
            className={button(tool.tool === t.tool)}
          >
            <span aria-hidden="true">{t.icon}</span>{' '}
            <span className="sr-only sm:not-sr-only">{t.label}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-1">
        {SIZE_PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            title={`Size ${p.size} ([ and ] to step)`}
            aria-pressed={tool.size === p.size}
            onClick={() => onChange({ ...tool, size: p.size })}
            className={button(tool.size === p.size)}
          >
            {p.label}
          </button>
        ))}
        <label className="ml-1 flex items-center gap-1 text-xs text-zinc-500" title={DRAG_HINT}>
          <span className="sr-only">Brush size</span>
          <input
            type="range"
            min={MIN_BRUSH_SIZE}
            max={MAX_BRUSH_SIZE}
            value={tool.size}
            onChange={(e) => onChange({ ...tool, size: Number(e.target.value) })}
            className="w-20 pointer-coarse:w-28"
          />
          {tool.size}
        </label>
      </div>

      <label className="flex items-center gap-1 text-xs text-zinc-500" title={DRAG_HINT}>
        Opacity
        <input
          type="range"
          min={5}
          max={100}
          step={5}
          value={Math.round(tool.opacity * 100)}
          onChange={(e) => onChange({ ...tool, opacity: Number(e.target.value) / 100 })}
          className="w-20 pointer-coarse:w-28"
        />
        {Math.round(tool.opacity * 100)}%
      </label>

      {tool.tool === 'fill' && (
        <label className="flex items-center gap-1 text-xs text-zinc-500" title={DRAG_HINT}>
          Tolerance
          <input
            type="range"
            min={0}
            max={MAX_FILL_TOLERANCE}
            value={tool.fillTolerance}
            onChange={(e) => onChange({ ...tool, fillTolerance: Number(e.target.value) })}
            className="w-20 pointer-coarse:w-28"
          />
          {tool.fillTolerance}
        </label>
      )}

      <div className="flex flex-wrap items-center gap-0.5" aria-label="Colours" title={COLOR_HINT}>
        {PALETTE.map((c) => (
          <button
            key={c.hex}
            type="button"
            title={c.label}
            aria-label={c.label}
            aria-pressed={tool.color === c.hex}
            onClick={() => onChange(withColor(tool, c.hex))}
            className={`size-5 rounded border pointer-coarse:size-9 ${tool.color === c.hex ? 'ring-2 ring-brand-600 ring-offset-1' : 'border-zinc-300'}`}
            style={{ backgroundColor: c.hex }}
          />
        ))}
        {onTogglePicking && (
          <button
            type="button"
            title="Pick up a colour from the drawing (or Alt+click)"
            aria-label="Pick up a colour from the drawing"
            aria-pressed={picking}
            onClick={onTogglePicking}
            className={`ml-1 ${button(picking)}`}
          >
            💧
          </button>
        )}
        <label className="ml-1" title="Custom colour">
          <span className="sr-only">Custom colour</span>
          <CustomColorInput
            value={tool.color}
            onLive={(color) => onChange({ ...tool, color })}
            onCommit={(color) => onChange(withColor(tool, color))}
            className="size-6 cursor-pointer pointer-coarse:size-9"
          />
        </label>
      </div>

      <div className="ml-auto flex gap-1">
        <button
          type="button"
          title="Undo (Ctrl+Z)"
          onClick={() => emit({ t: 'draw:undo' })}
          className={button(false)}
        >
          ↶ <span className="sr-only">Undo</span>
        </button>
        <button
          type="button"
          title="Redo (Ctrl+Shift+Z)"
          onClick={() => emit({ t: 'draw:redo' })}
          className={button(false)}
        >
          ↷ <span className="sr-only">Redo</span>
        </button>
        <button
          type="button"
          title="Clear canvas"
          onClick={() => {
            if (window.confirm('Clear the whole drawing? You can undo this.'))
              emit({ t: 'draw:clear' });
          }}
          className={button(false)}
        >
          🗑 <span className="sr-only">Clear</span>
        </button>
      </div>

      <p className="hidden w-full text-xs text-zinc-500 sm:block pointer-coarse:hidden">
        Tip: {DRAG_HINT}. Esc cancels. {COLOR_HINT}.
      </p>
    </div>
  );
}
