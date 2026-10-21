import { CURSE_TUNING, type Curse } from '@pictiotheme/protocol/tower';

/** How each curse is named on screen (docs/tower/planning/power-ups.md). */
export const CURSE_LABEL: Record<Curse, { icon: string; name: string; effect: string }> = {
  slippery: { icon: '🧊', name: 'Slippery', effect: 'slides off anything' },
  big_ice: { icon: '❄️', name: 'Big ice', effect: 'bigger, and slippery' },
  melt: { icon: '🫠', name: 'Melt', effect: 'droops and rounds off: it rocks' },
  bouncy: {
    icon: '🏀',
    name: 'Bouncy',
    effect: `bounces for ${CURSE_TUNING.bouncyMs / 1000}s after it lands`,
  },
  blob: { icon: '🍮', name: 'Blob', effect: 'bigger, and melted' },
};

/** "🧊 Slippery" or "❄️ Big ice + 🏀 Bouncy". */
export const curseNames = (curses: readonly Curse[]) =>
  curses.map((c) => `${CURSE_LABEL[c].icon} ${CURSE_LABEL[c].name}`).join(' + ');
