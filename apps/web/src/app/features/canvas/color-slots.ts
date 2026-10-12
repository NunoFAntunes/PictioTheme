import { create } from 'zustand';

/**
 * The five colour slots (drawing-tools.md#colour-slots): `1`–`5` switch to one, `Shift` + the
 * digit saves the current colour there. Yours, not the room's: remembered in this browser and
 * shared by every pad. Storage can be unavailable (private mode, blocked site data), so every
 * access is guarded.
 */

export const SLOT_COUNT = 5;

const STORAGE_KEY = 'pictiotheme.color-slots';

export const DEFAULT_SLOTS: readonly string[] = [
  '#000000',
  '#dc2626',
  '#3b82f6',
  '#16a34a',
  '#facc15',
];

const HEX = /^#[0-9a-f]{6}$/;

/** Reads stored slots, keeping the default for any slot missing or malformed. */
export function parseColorSlots(raw: unknown): string[] {
  const stored = Array.isArray(raw) ? (raw as unknown[]) : [];
  return DEFAULT_SLOTS.map((fallback, i) => {
    const c = stored[i];
    return typeof c === 'string' && HEX.test(c.toLowerCase()) ? c.toLowerCase() : fallback;
  });
}

function load(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return parseColorSlots(raw ? JSON.parse(raw) : null);
  } catch {
    return [...DEFAULT_SLOTS];
  }
}

function save(slots: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(slots));
  } catch {
    // Not persisted; the slots still work in this tab.
  }
}

type ColorSlotsStore = {
  slots: string[];
  /** Saves `color` in slot `index` (0-based). */
  setSlot: (index: number, color: string) => void;
};

export const useColorSlots = create<ColorSlotsStore>((set, get) => ({
  slots: load(),
  setSlot: (index, color) => {
    const hex = color.toLowerCase();
    if (index < 0 || index >= SLOT_COUNT || get().slots[index] === hex) return;
    const slots = get().slots.map((c, i) => (i === index ? hex : c));
    set({ slots });
    save(slots);
  },
}));
