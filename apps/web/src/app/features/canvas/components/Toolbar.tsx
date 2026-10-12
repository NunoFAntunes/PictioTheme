import { useCallback, useEffect, useRef, useSyncExternalStore, type ComponentType } from 'react';
import { drawAndSend, strokeModel, type DrawOp, type StrokeModel } from '../../../realtime';
import { useColorSlots } from '../color-slots';
import { ALT, MOD, useKeyLabel, useShortcutHints } from '../shortcut-hints';
import { applyShortcut, shortcutFor, TOOL_KEY_CODES } from '../shortcuts';
import { withColor, type Tool, type ToolSettings } from '../tools';
import type { ToggleColorPopover } from '../use-color-popover';
import { BrushControls } from './BrushControls';
import { ColorSlots } from './ColorSlots';
import { InkWell, PaletteGrid } from './ColorControls';
import {
  BucketIcon,
  DropperIcon,
  EraserIcon,
  KeyboardIcon,
  PencilIcon,
  RedoIcon,
  TrashIcon,
  UndoIcon,
} from './ToolIcons';
import { ToolbarHelp } from './ToolbarHelp';
import { Keycap, Zone } from './ToolbarParts';

type Props = {
  tool: ToolSettings;
  onChange: (next: ToolSettings) => void;
  /** `C` (held: release over a colour to pick it) or the ink well: the colour popover. */
  onToggleColorPopover: ToggleColorPopover;
  /** Where undo/redo/clear go. Defaults to the room; a pad applies them locally. */
  emit?: (op: DrawOp) => void;
  /** The drawing `emit` changes, so undo and redo know when there's nothing to do. */
  model?: StrokeModel;
  /** Labels the toolbar. */
  label?: string;
  /** The eyedropper is armed (the way to pick up a colour on touch, without Alt). */
  picking?: boolean;
  onTogglePicking?: () => void;
};

/** In the order of their keys, Q W E. */
const TOOLS: {
  tool: Tool;
  label: string;
  Icon: ComponentType<{ className?: string; ink?: string }>;
}[] = [
  { tool: 'brush', label: 'Brush', Icon: PencilIcon },
  { tool: 'fill', label: 'Fill', Icon: BucketIcon },
  { tool: 'eraser', label: 'Eraser', Icon: EraserIcon },
];

const UNDO_KEYS = `${MOD}${MOD === 'Ctrl' ? ' ' : ''}Z`;
const REDO_KEYS = MOD === 'Ctrl' ? 'Ctrl ⇧Z' : '⇧⌘Z';

/** Inputs that take no typing: a slider just used keeps the focus, and Q or 2 must still work. */
const NOT_TYPED = ['range', 'checkbox', 'radio', 'button', 'submit', 'reset', 'color'];

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target instanceof HTMLInputElement) return !NOT_TYPED.includes(target.type);
  return target.isContentEditable || ['TEXTAREA', 'SELECT'].includes(target.tagName);
}

/** A modal dialog over this toolbar (the avatar editor, opened mid-turn) takes the shortcuts. */
function isBehindModal(toolbar: HTMLElement | null): boolean {
  const modal = document.querySelector('dialog:modal');
  return modal !== null && !(toolbar && modal.contains(toolbar));
}

function ToolButton({
  tool,
  label,
  Icon,
  active,
  color,
  onSelect,
}: (typeof TOOLS)[number] & { active: boolean; color: string; onSelect: () => void }) {
  const key = useKeyLabel(TOOL_KEY_CODES[tool]);
  return (
    <button
      type="button"
      title={`${label} (${key})`}
      aria-label={label}
      aria-pressed={active}
      aria-keyshortcuts={key}
      onClick={onSelect}
      className={`relative grid size-11 place-items-center rounded-xl border-2 transition pointer-coarse:size-12 ${active ? '-translate-y-0.5 -rotate-3 border-ink bg-pop-sun text-ink shadow-[2px_3px_0_var(--color-ink)] motion-safe:animate-choice-wiggle' : 'border-transparent hover:-rotate-2 hover:bg-white dark:hover:bg-zinc-700'}`}
    >
      <Icon className="size-8" ink={color} />
      <Keycap>{key}</Keycap>
    </button>
  );
}

/** Drawer-only tools, in four zones. Shortcuts: docs/product/drawing-tools.md#keyboard-shortcuts. */
export function Toolbar({
  tool,
  onChange,
  onToggleColorPopover,
  emit = drawAndSend,
  model = strokeModel,
  label = 'Drawing tools',
  picking = false,
  onTogglePicking,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const hintsShown = useShortcutHints((s) => s.shown);
  const toggleHints = useShortcutHints((s) => s.toggle);
  const subscribe = useCallback((onChange: () => void) => model.subscribe(onChange), [model]);
  const canUndo = useSyncExternalStore(subscribe, () => model.strokes.length > 0);
  const canRedo = useSyncExternalStore(subscribe, () => model.canRedo);
  const blank = useSyncExternalStore(subscribe, () => {
    const last = model.strokes.at(-1);
    return !last || last.tool === 'clear';
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || isBehindModal(ref.current)) return;
      const shortcut = shortcutFor(e);
      if (!shortcut) return;
      e.preventDefault();
      if (shortcut.kind === 'undo' || shortcut.kind === 'redo') {
        emit({ t: shortcut.kind === 'redo' ? 'draw:redo' : 'draw:undo' });
        return;
      }
      if (shortcut.kind === 'color-popover') {
        if (!e.repeat) onToggleColorPopover({ hold: 'key' });
        return;
      }
      if (shortcut.kind === 'slot') {
        const { slots, setSlot } = useColorSlots.getState();
        const slot = slots[shortcut.slot];
        if (shortcut.save) setSlot(shortcut.slot, tool.color);
        else if (slot) onChange(withColor(tool, slot));
        return;
      }
      onChange(applyShortcut(tool, shortcut));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tool, onChange, onToggleColorPopover, emit]);

  // Touch screens get finger-sized targets (44 px, rule W15); mouse users keep the compact bar.
  const iconButton =
    'relative grid size-10 place-items-center rounded-xl transition pointer-coarse:size-11 enabled:hover:bg-white disabled:opacity-35 dark:enabled:hover:bg-zinc-700';

  return (
    <div
      ref={ref}
      className="flex max-w-full min-w-0 flex-col gap-2 rounded-2xl border border-zinc-200 bg-white p-2 text-ink shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
      role="toolbar"
      aria-label={label}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Zone label="Tools">
          {TOOLS.map((t) => (
            <ToolButton
              key={t.tool}
              {...t}
              active={tool.tool === t.tool}
              color={tool.color}
              onSelect={() => onChange({ ...tool, tool: t.tool })}
            />
          ))}
        </Zone>

        <BrushControls tool={tool} onChange={onChange} />

        <div className="ml-auto flex items-center gap-2">
          <Zone label="History">
            <button
              type="button"
              title={`Undo (${UNDO_KEYS})`}
              aria-label="Undo"
              aria-keyshortcuts="Control+Z Meta+Z"
              disabled={!canUndo}
              onClick={() => emit({ t: 'draw:undo' })}
              className={iconButton}
            >
              <UndoIcon className="size-7" />
              <Keycap>{UNDO_KEYS}</Keycap>
            </button>
            <button
              type="button"
              title={`Redo (${REDO_KEYS})`}
              aria-label="Redo"
              aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z"
              disabled={!canRedo}
              onClick={() => emit({ t: 'draw:redo' })}
              className={iconButton}
            >
              <RedoIcon className="size-7" />
              <Keycap>{REDO_KEYS}</Keycap>
            </button>
          </Zone>
          <button
            type="button"
            title="Clear the whole drawing"
            aria-label="Clear canvas"
            disabled={blank}
            onClick={() => {
              if (window.confirm('Clear the whole drawing? You can undo this.'))
                emit({ t: 'draw:clear' });
            }}
            className={`${iconButton} enabled:hover:bg-red-50 dark:enabled:hover:bg-red-950`}
          >
            <TrashIcon className="size-7" />
          </button>
          <button
            type="button"
            title={hintsShown ? 'Hide the keys on the buttons' : 'Show the keys on the buttons'}
            aria-label="Show shortcut keys"
            aria-pressed={hintsShown}
            onClick={toggleHints}
            className={`grid size-9 place-items-center rounded-full pointer-coarse:hidden ${hintsShown ? 'text-ink dark:text-zinc-100' : 'text-zinc-400'} hover:bg-zinc-100 dark:hover:bg-zinc-800`}
          >
            <KeyboardIcon className="size-6" />
          </button>
          <ToolbarHelp />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Zone label="Colour" className="gap-2 pr-2">
          <InkWell
            tool={tool}
            onOpen={() => onToggleColorPopover()}
            onSwap={() => onChange(applyShortcut(tool, { kind: 'swap-color' }))}
          />
          {onTogglePicking && (
            <button
              type="button"
              title={`Pick up a colour from the drawing (or ${ALT}+click)`}
              aria-label="Pick up a colour from the drawing"
              aria-pressed={picking}
              onClick={onTogglePicking}
              className={`relative grid size-10 place-items-center rounded-xl border-2 transition pointer-coarse:size-11 ${picking ? 'border-ink bg-pop-sun text-ink shadow-[2px_3px_0_var(--color-ink)]' : 'border-transparent hover:bg-white dark:hover:bg-zinc-700'}`}
            >
              <DropperIcon className="size-7" ink={tool.color} />
              <Keycap>{`${ALT}+click`}</Keycap>
            </button>
          )}
        </Zone>

        <ColorSlots color={tool.color} onUse={(color) => onChange(withColor(tool, color))} />

        <Zone label="Palette" className="px-2 py-1.5">
          <PaletteGrid
            swatch={(c) => {
              const active = tool.color === c.hex;
              return (
                <button
                  key={c.hex}
                  type="button"
                  title={c.label}
                  aria-label={c.label}
                  aria-pressed={active}
                  onClick={() => onChange(withColor(tool, c.hex))}
                  className={`size-5 rounded-[5px] transition hover:scale-115 pointer-coarse:size-9 ${active ? 'relative z-10 scale-115 ring-2 ring-ink ring-offset-1 dark:ring-zinc-100 dark:ring-offset-zinc-900' : 'ring-1 ring-black/15 ring-inset'}`}
                  style={{ backgroundColor: c.hex }}
                />
              );
            }}
          />
        </Zone>
      </div>
    </div>
  );
}
