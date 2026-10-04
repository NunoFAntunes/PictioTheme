import { stepSize, stepTolerance } from './engine/adjust';
import { previousColor, withColor, type Tool, type ToolSettings } from './tools';

/**
 * Drawer keyboard shortcuts (drawing-tools.md#keyboard-shortcuts).
 *
 * Size and opacity keys match the physical key (`code`), not the character: on Portuguese,
 * German or Spanish layouts `[` and `]` need AltGr, and AZERTY digits need Shift.
 * Tool letters and Ctrl/Cmd+Z follow the character (`key`), so they match what's printed on the key.
 */

export type Shortcut =
  | { kind: 'undo' }
  | { kind: 'redo' }
  | { kind: 'tool'; tool: Tool }
  | { kind: 'size'; direction: 1 | -1; big: boolean }
  | { kind: 'opacity'; opacity: number }
  | { kind: 'swap-color' }
  | { kind: 'color-popover' };

export type KeyInput = Pick<
  KeyboardEvent,
  'key' | 'code' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'
>;

const TOOL_KEYS: Record<string, Tool> = { b: 'brush', e: 'eraser', f: 'fill' };
const SMALLER = ['BracketLeft', 'Minus', 'NumpadSubtract'];
const LARGER = ['BracketRight', 'Equal', 'NumpadAdd'];

export function shortcutFor(e: KeyInput): Shortcut | null {
  const key = e.key.toLowerCase();
  if (e.ctrlKey || e.metaKey) {
    if (key === 'z' && !e.altKey) return { kind: e.shiftKey ? 'redo' : 'undo' };
    return null; // leave browser shortcuts (zoom, reload, …) alone
  }
  if (e.altKey) return null; // Alt is the eyedropper; AltGr also reports Alt

  if (SMALLER.includes(e.code)) return { kind: 'size', direction: -1, big: e.shiftKey };
  if (LARGER.includes(e.code)) return { kind: 'size', direction: 1, big: e.shiftKey };
  const digit = /^(?:Digit|Numpad)(\d)$/.exec(e.code)?.[1];
  if (digit !== undefined)
    return { kind: 'opacity', opacity: digit === '0' ? 1 : Number(digit) / 10 };
  if (e.shiftKey) return null;
  const tool = TOOL_KEYS[key];
  if (tool) return { kind: 'tool', tool };
  if (key === 'x') return { kind: 'swap-color' };
  if (key === 'c') return { kind: 'color-popover' };
  return null;
}

/** Settings after a setting shortcut. On Fill, the size keys change tolerance instead. */
export function applyShortcut(
  tool: ToolSettings,
  shortcut: Exclude<Shortcut, { kind: 'undo' | 'redo' | 'color-popover' }>,
): ToolSettings {
  switch (shortcut.kind) {
    case 'tool':
      return { ...tool, tool: shortcut.tool };
    case 'opacity':
      return { ...tool, opacity: shortcut.opacity };
    case 'swap-color': {
      const previous = previousColor(tool);
      return previous ? withColor(tool, previous) : tool;
    }
    case 'size':
      return tool.tool === 'fill'
        ? {
            ...tool,
            fillTolerance: stepTolerance(tool.fillTolerance, shortcut.direction, shortcut.big),
          }
        : { ...tool, size: stepSize(tool.size, shortcut.direction, shortcut.big) };
  }
}
