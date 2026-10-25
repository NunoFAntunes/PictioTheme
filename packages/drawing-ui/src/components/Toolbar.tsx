import { useCallback, useEffect, useRef, useSyncExternalStore, type ComponentType } from 'react';
import type { DrawOp, StrokeModel } from '@pictiotheme/canvas-engine';
import { useColorSlots } from '../color-slots';
import { ALT, MOD, useKeyLabel, useShortcutHints } from '../shortcut-hints';
import { applyShortcut, DROPPER_KEY_CODE, shortcutFor, TOOL_KEY_CODES } from '../shortcuts';
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
  /** `C` or Space (held: release over a colour to pick it) or the ink well: the colour popover. */
  onToggleColorPopover: ToggleColorPopover;
  /** Where undo/redo/clear go: the room's socket, or a pad applying them locally. */
  emit: (op: DrawOp) => void;
  /** The drawing `emit` changes, so undo and redo know when there's nothing to do. */
  model: StrokeModel;
  /** Labels the toolbar. */
  label?: string;
  /** The eyedropper is armed, by its button or `S` (the way to pick up a colour without Alt). */
  picking?: boolean;
  onTogglePicking?: () => void;
  /**
   * `row`: the game's bar under the board. `panel`: a column of full-width trays beside a pad
   * (the avatar and deck cover pads), about 22rem wide.
   */
  layout?: 'row' | 'panel';
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

/**
 * Space presses a control the player reached with the keyboard (Tab, then Space), so it opens the
 * colours only when nothing was. A mouse click leaves its button focused but not `:focus-visible`.
 * The colour popover focuses its own swatch on opening; Space there toggles it as anywhere else.
 */
function spaceBelongsToControl(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement) || target === document.body) return false;
  if (target.closest('[role="dialog"][aria-label="Colours"]')) return false;
  return target.matches(':focus-visible');
}

/** `S` held at least this long is spring-loaded: letting go puts the dropper away again. */
const DROPPER_HOLD_MS = 300;

/**
 * Shortcuts are someone else's while a modal dialog is over this toolbar (the avatar editor,
 * opened mid-turn), or while this toolbar is hidden (a closed dialog keeps its pad's drawing).
 */
function isInactive(toolbar: HTMLElement | null): boolean {
  if (!toolbar || !toolbar.checkVisibility()) return true;
  const modal = document.querySelector('dialog:modal');
  return modal !== null && !modal.contains(toolbar);
}

function ToolButton({
  tool,
  label,
  Icon,
  active,
  color,
  wide,
  onSelect,
}: (typeof TOOLS)[number] & {
  active: boolean;
  color: string;
  /** Share the tray's width (the panel layout). */
  wide: boolean;
  onSelect: () => void;
}) {
  const key = useKeyLabel(TOOL_KEY_CODES[tool]);
  return (
    <button
      type="button"
      title={`${label} (${key})`}
      aria-label={label}
      aria-pressed={active}
      aria-keyshortcuts={key}
      onClick={onSelect}
      className={`relative grid place-items-center rounded-xl border-2 transition ${wide ? 'h-14 flex-1' : 'h-16 w-14'} ${active ? '-translate-y-0.5 -rotate-3 border-ink bg-pop-sun text-ink shadow-[2px_3px_0_var(--color-ink)] motion-safe:animate-choice-wiggle' : 'border-transparent hover:-rotate-2 hover:bg-white dark:hover:bg-zinc-700'}`}
    >
      <Icon className="size-10" ink={color} />
      <Keycap>{key}</Keycap>
    </button>
  );
}

/** Drawer-only tools, in four zones. Shortcuts: docs/product/drawing-tools.md#keyboard-shortcuts. */
export function Toolbar({
  tool,
  onChange,
  onToggleColorPopover,
  emit,
  model,
  label = 'Drawing tools',
  picking = false,
  onTogglePicking,
  layout = 'row',
}: Props) {
  const panel = layout === 'panel';
  const ref = useRef<HTMLDivElement>(null);
  /** When `S` armed the dropper, while it's still down. */
  const dropperDownAt = useRef<number | null>(null);
  /** Space opened or closed the colours: its keyup must not press a button either. */
  const spaceTaken = useRef(false);
  const dropperKey = useKeyLabel(DROPPER_KEY_CODE);
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
      if (isTyping(e.target) || isInactive(ref.current)) return;
      if (e.code === 'Space' && spaceBelongsToControl(e.target)) return;
      const shortcut = shortcutFor(e);
      if (!shortcut) return;
      e.preventDefault();
      if (e.code === 'Space') spaceTaken.current = true;
      if (shortcut.kind === 'undo' || shortcut.kind === 'redo') {
        emit({ t: shortcut.kind === 'redo' ? 'draw:redo' : 'draw:undo' });
        return;
      }
      if (shortcut.kind === 'color-popover') {
        if (!e.repeat) onToggleColorPopover({ hold: { code: e.code } });
        return;
      }
      if (shortcut.kind === 'dropper') {
        if (e.repeat || !onTogglePicking) return;
        dropperDownAt.current = picking ? null : performance.now();
        onTogglePicking();
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
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && spaceTaken.current) {
        spaceTaken.current = false;
        e.preventDefault();
      }
      if (e.code !== DROPPER_KEY_CODE || dropperDownAt.current === null) return;
      // A tap leaves the dropper armed for the next click; a hold puts it away (if a pick hasn't).
      const heldFor = performance.now() - dropperDownAt.current;
      dropperDownAt.current = null;
      if (heldFor >= DROPPER_HOLD_MS && picking) onTogglePicking?.();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [tool, onChange, onToggleColorPopover, emit, picking, onTogglePicking]);

  // Touch screens get finger-sized targets (44 px, rule W15); mouse users keep the compact bar.
  const iconButton =
    'relative grid place-items-center rounded-lg transition enabled:hover:bg-white disabled:opacity-35 dark:enabled:hover:bg-zinc-700';

  const tools = (
    <Zone label="Tools">
      {TOOLS.map((t) => (
        <ToolButton
          key={t.tool}
          {...t}
          active={tool.tool === t.tool}
          color={tool.color}
          wide={panel}
          onSelect={() => onChange({ ...tool, tool: t.tool })}
        />
      ))}
    </Zone>
  );

  const colour = (
    <Zone label="Colour" className="gap-2 pr-2">
      <InkWell
        tool={tool}
        onOpen={() => onToggleColorPopover()}
        onSwap={() => onChange(applyShortcut(tool, { kind: 'swap-color' }))}
      />
      {onTogglePicking && (
        <button
          type="button"
          title={`Pick up a colour from the drawing (${dropperKey}, or hold ${dropperKey} or ${ALT} and click)`}
          aria-label="Pick up a colour from the drawing"
          aria-keyshortcuts={dropperKey}
          aria-pressed={picking}
          onClick={onTogglePicking}
          className={`relative grid h-16 w-11 place-items-center rounded-xl border-2 transition ${picking ? 'border-ink bg-pop-sun text-ink shadow-[2px_3px_0_var(--color-ink)]' : 'border-transparent hover:bg-white dark:hover:bg-zinc-700'}`}
        >
          <DropperIcon className="size-8" ink={tool.color} />
          <Keycap>{dropperKey}</Keycap>
        </button>
      )}
    </Zone>
  );

  const slots = (
    <ColorSlots
      color={tool.color}
      onUse={(color) => onChange(withColor(tool, color))}
      fill={panel}
    />
  );

  const palette = (
    <Zone label="Palette" className="px-2">
      <PaletteGrid
        tight
        // The panel is narrow: two bands of 7 columns, stretched to its width.
        wrapAt={panel ? 7 : undefined}
        fill={panel}
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
              className={`rounded-[5px] transition hover:scale-115 ${panel ? 'h-5 w-full pointer-coarse:h-9' : 'h-7 w-5 pointer-coarse:size-9'} ${active ? 'relative z-10 scale-115 ring-2 ring-ink ring-offset-1 dark:ring-zinc-100 dark:ring-offset-zinc-900' : 'ring-1 ring-black/15 ring-inset'}`}
              style={{ backgroundColor: c.hex }}
            />
          );
        }}
      />
    </Zone>
  );

  const undoRedo = (
    <div className="flex gap-1">
      <button
        type="button"
        title={`Undo (${UNDO_KEYS})`}
        aria-label="Undo"
        aria-keyshortcuts="Control+Z Meta+Z"
        disabled={!canUndo}
        onClick={() => emit({ t: 'draw:undo' })}
        className={`${iconButton} h-8 w-11 pointer-coarse:size-11`}
      >
        <UndoIcon className="size-6" />
        <Keycap className="-top-1.5 -right-1">{UNDO_KEYS}</Keycap>
      </button>
      <button
        type="button"
        title={`Redo (${REDO_KEYS})`}
        aria-label="Redo"
        aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z"
        disabled={!canRedo}
        onClick={() => emit({ t: 'draw:redo' })}
        className={`${iconButton} h-8 w-11 pointer-coarse:size-11`}
      >
        <RedoIcon className="size-6" />
        <Keycap className="-top-1.5 -right-1">{REDO_KEYS}</Keycap>
      </button>
    </div>
  );

  const extras = (
    <div className="flex justify-between gap-1">
      <button
        type="button"
        title="Clear the whole drawing"
        aria-label="Clear canvas"
        disabled={blank}
        onClick={() => {
          if (window.confirm('Clear the whole drawing? You can undo this.'))
            emit({ t: 'draw:clear' });
        }}
        className={`${iconButton} size-7 enabled:hover:bg-red-50 pointer-coarse:size-11 dark:enabled:hover:bg-red-950`}
      >
        <TrashIcon className="size-5 pointer-coarse:size-7" />
      </button>
      <button
        type="button"
        title={hintsShown ? 'Hide the keys on the buttons' : 'Show the keys on the buttons'}
        aria-label="Show shortcut keys"
        aria-pressed={hintsShown}
        onClick={toggleHints}
        className={`${iconButton} size-7 pointer-coarse:hidden ${hintsShown ? 'text-ink dark:text-zinc-100' : 'text-zinc-400'}`}
      >
        <KeyboardIcon className="size-5" />
      </button>
      <ToolbarHelp />
    </div>
  );

  const box =
    'rounded-2xl border border-zinc-200 bg-white p-2 text-ink shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100';

  if (panel)
    return (
      <div
        ref={ref}
        className={`flex w-full min-w-0 flex-col gap-2 ${box}`}
        role="toolbar"
        aria-label={label}
      >
        {tools}
        <div className="flex flex-wrap gap-2">
          {colour}
          {slots}
        </div>
        {palette}
        <BrushControls tool={tool} onChange={onChange} panel />
        <Zone label="History" className="justify-between pt-1.5">
          {undoRedo}
          {extras}
        </Zone>
      </div>
    );

  return (
    <div
      ref={ref}
      className={`@container flex max-w-full min-w-0 flex-wrap items-stretch gap-2 ${box}`}
      role="toolbar"
      aria-label={label}
    >
      {/* Tools and colours on the left, settings on the right. One row where it fits; where it
          doesn't, the settings wrap under as a whole. Trays in a line stretch to one height. */}
      <div className="flex min-w-0 flex-wrap items-stretch gap-2">
        {tools}
        {colour}
        {slots}
        {palette}
      </div>

      <div className="ml-auto flex flex-wrap items-stretch gap-2">
        <BrushControls tool={tool} onChange={onChange} />

        {/* Undo and redo big on top, clear and the help buttons small underneath: short enough
            for the single row. Where the bar wraps anyway (under ~1380 px, about what the row
            needs) and on touch screens, they sit in a line. */}
        <Zone
          label="History"
          className="flex-col gap-0.5 @max-[86rem]:flex-row @max-[86rem]:gap-1 pointer-coarse:flex-row"
        >
          {undoRedo}
          {extras}
        </Zone>
      </div>
    </div>
  );
}
