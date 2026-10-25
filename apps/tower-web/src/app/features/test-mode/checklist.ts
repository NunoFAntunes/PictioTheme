import type { Curse } from '@pictiotheme/protocol/tower';
import { create } from 'zustand';

/**
 * Test mode's checklist (docs/tower/planning/test-mode.md): what to try with each power and what
 * to look for, from docs/tower/planning/power-ups.md. Ticks are remembered in this browser only
 * (a per-viewer convenience); storage can be unavailable, so every access is guarded.
 */

export type CheckItem = { id: string; label: string; how?: string };
export type CheckGroup = { title: string; items: CheckItem[] };

export const CHECKLIST: CheckGroup[] = [
  {
    title: 'Keep or Curse',
    items: [
      {
        id: 'decide-card',
        label: 'The decide card shows the rolled curse on 🌀 Curse',
        how: 'K and C work; after 5s it keeps',
      },
      {
        id: 'kept-normal',
        label: 'A kept piece behaves normally, whatever curse it rolled',
      },
      {
        id: 'curse-sent',
        label: 'A piece you curse lands on their tower, with its look and sound',
        how: 'The banner names the curse; the buildbot places it',
      },
      {
        id: 'curse-received',
        label: 'A piece cursed at you: you place it, the banner names the curse',
        how: 'Rival → "Solve theirs, curse at you"',
      },
    ],
  },
  {
    title: 'Curses (pick one under "Next piece")',
    items: [
      {
        id: 'slippery',
        label: '🧊 Slippery slides off a slope that holds a normal piece',
        how: 'Frost on it; a glassy tink when it lands',
      },
      { id: 'big-ice', label: '❄️ Big ice is clearly bigger (×1.4 area) and slippery' },
      {
        id: 'melt',
        label: '🫠 Melt droops in the middle, doodle and all, and rocks',
        how: 'Top dips, bottom bulges, corners round off',
      },
      {
        id: 'bouncy',
        label: '🏀 Bouncy bounces when it lands, then calms down after 3s',
        how: 'A boing when it lands',
      },
      { id: 'blob', label: '🍮 Blob is bigger and melted', how: 'A squelch when it lands' },
      {
        id: 'golden-double',
        label: 'A golden piece rolls two curses that don’t clash',
        how: 'Make your drawing golden, pick 🎲 Random, solve it',
      },
    ],
  },
  {
    title: 'Casting',
    items: [
      {
        id: 'inventory',
        label: 'Both crews’ spells show in their tower headers',
      },
      {
        id: 'cast',
        label: 'Casting by button and by 1 / 2 works, after a 2s warning',
        how: 'A whoosh when you cast, a "dun-dun-dun" when cast at you',
      },
      {
        id: 'one-at-a-time',
        label: 'You can’t cast while their tower is already under a spell',
      },
      { id: 'full', label: 'A crew holding two spells doesn’t earn a third' },
    ],
  },
  {
    title: 'Spells',
    items: [
      {
        id: 'fog-them',
        label: '🌫️ Fog on them is see-through for you, for 10s',
      },
      {
        id: 'fog-you',
        label: '🌫️ Fog on you hides the top of your tower, not the piece or guide line',
        how: 'Give Teal a Fog, then "Rival casts"',
      },
      {
        id: 'magpie-them',
        label: '🐦‍⬛ Your Magpie flies off with the top piece of their tower, and you place it',
        how: 'Rival → "Solve theirs, keep it" so they have a tower, then cast it',
      },
      {
        id: 'magpie-you',
        label: '🐦‍⬛ Their Magpie flies in to your top piece and off with it',
        how: 'Place a piece, then Rival casts it',
      },
      {
        id: 'magpie-wait',
        label: '🐦‍⬛ At a tower with nothing on it, the magpie flies off empty-handed',
      },
      {
        id: 'shaky-them',
        label: '〰️ Shaky hand: their next drawing wobbles',
        how: 'Cast it, then steal theirs: the new one wobbles',
      },
      {
        id: 'shaky-you',
        label: '〰️ Shaky hand on you: your crew’s next drawing wobbles',
      },
      {
        id: 'pigeon',
        label: '🐦 Three pigeons perch on the edges of three different pieces and tip them',
        how: 'They don’t count for height; with fewer pieces, the rest land on the platform',
      },
      {
        id: 'pigeon-leaves',
        label: '🐦 A new piece scares off the ones it touches; the rest fly away after 25s',
      },
    ],
  },
  {
    title: 'Earning spells',
    items: [
      {
        id: 'golden',
        label: '✨ A golden drawing is gold for both crews; solving it gives a spell',
      },
      { id: 'golden-steal', label: '✨ Stealing a golden drawing gives the spell to you' },
      {
        id: 'comeback-fumble',
        label: '🆘 A piece falling off your tower gives you a spell',
        how: 'At most one comeback spell every 90s',
      },
      {
        id: 'comeback-behind',
        label: '🆘 Being 2 m behind for 20s gives you a spell',
        how: 'Rival → "Solve theirs, keep it" a few times',
      },
      {
        id: 'star-catch',
        label: '⭐ A settled piece touching the star for 3s catches it',
        how: '"Stars now"; the ring fills while it’s held',
      },
      {
        id: 'star-miss',
        label: '⭐ A piece sliding or falling through it doesn’t count; it goes after 45s',
      },
    ],
  },
  {
    title: 'Powers off',
    items: [
      {
        id: 'powers-off',
        label: 'With "Curses & spells" off: Curse just sends, no golden words, no stars',
        how: 'Back to the waiting room (rematch) and switch it off',
      },
    ],
  },
];

export const CHECK_COUNT = CHECKLIST.reduce((n, g) => n + g.items.length, 0);

const STORAGE_KEY = 'doodle-tower.test-checklist';

function load(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

function save(done: Set<string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...done]));
  } catch {
    // Storage unavailable: the ticks last until the page closes.
  }
}

type TestModeState = {
  /** Ticked checklist items. */
  done: Set<string>;
  toggle: (id: string) => void;
  reset: () => void;
  /** The curse the next piece gets (from either crew's solve). Null: rolled as in a match. */
  curse: Curse | null;
  setCurse: (curse: Curse | null) => void;
};

export const useTestMode = create<TestModeState>((set, get) => ({
  done: load(),
  toggle: (id) => {
    const done = new Set(get().done);
    if (done.has(id)) done.delete(id);
    else done.add(id);
    save(done);
    set({ done });
  },
  reset: () => {
    save(new Set());
    set({ done: new Set() });
  },
  curse: null,
  setCurse: (curse) => set({ curse }),
}));
