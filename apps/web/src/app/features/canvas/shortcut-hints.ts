import { useEffect } from 'react';
import { create } from 'zustand';
import { TOOL_KEY_CODES } from './shortcuts';

/**
 * The keycap badges on the toolbar's buttons (drawing-tools.md#keyboard-shortcuts): on unless the
 * player hid them with ⌨, remembered in this browser and shared by every pad. Storage can be
 * unavailable (private mode, blocked site data), so every access is guarded.
 */

const STORAGE_KEY = 'pictiotheme.shortcut-hints';

export const IS_MAC =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent);
export const MOD = IS_MAC ? '⌘' : 'Ctrl';
export const ALT = IS_MAC ? '⌥' : 'Alt';

function load(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'off';
  } catch {
    return true;
  }
}

type ShortcutHintsStore = {
  shown: boolean;
  toggle: () => void;
  /** What the keyboard layout prints on each tool key (`KeyQ` → `A` on AZERTY), once known. */
  labels: Record<string, string>;
};

export const useShortcutHints = create<ShortcutHintsStore>((set, get) => ({
  shown: load(),
  toggle: () => {
    const shown = !get().shown;
    set({ shown });
    try {
      localStorage.setItem(STORAGE_KEY, shown ? 'on' : 'off');
    } catch {
      // Not persisted; the toggle still works in this tab.
    }
  },
  labels: {},
}));

type LayoutMapKeyboard = { getLayoutMap?: () => Promise<ReadonlyMap<string, string>> };
let layoutRequested = false;

/**
 * The label for a physical key: what the layout prints there where the browser says (Chromium's
 * Keyboard Map API), else the QWERTY letter.
 */
export function useKeyLabel(code: string): string {
  const label = useShortcutHints((s) => s.labels[code]);
  useEffect(() => {
    if (layoutRequested) return;
    layoutRequested = true;
    const keyboard = (navigator as Navigator & { keyboard?: LayoutMapKeyboard }).keyboard;
    keyboard
      ?.getLayoutMap?.()
      .then((map) => {
        const labels: Record<string, string> = {};
        for (const c of Object.values(TOOL_KEY_CODES)) {
          const printed = map.get(c);
          if (printed) labels[c] = printed.toUpperCase();
        }
        useShortcutHints.setState({ labels });
      })
      .catch(() => {}); // not allowed here (an iframe): keep the QWERTY letters
  }, []);
  return label ?? code.replace(/^Key/, '');
}
