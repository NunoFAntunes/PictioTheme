import { create } from 'zustand';

/**
 * Which side of the house rules this player looks at: the simple view (four ready-made games,
 * the default) or all the rules. Each player flips it for themselves, remembered in this browser.
 * Storage can be unavailable (private mode, blocked site data), so every access is guarded.
 */

const STORAGE_KEY = 'pictiotheme.house-rules-view';

export type HouseRulesView = 'simple' | 'all';

function load(): HouseRulesView {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'all' ? 'all' : 'simple';
  } catch {
    return 'simple';
  }
}

type HouseRulesViewStore = { view: HouseRulesView; flip: () => void };

export const useHouseRulesView = create<HouseRulesViewStore>((set, get) => ({
  view: load(),
  flip: () => {
    const view = get().view === 'simple' ? 'all' : 'simple';
    set({ view });
    try {
      localStorage.setItem(STORAGE_KEY, view);
    } catch {
      // Not persisted; the flip still works in this tab.
    }
  },
}));
