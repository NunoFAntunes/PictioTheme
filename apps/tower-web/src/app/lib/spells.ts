import { SPELL_TUNING, type Spell } from '@pictiotheme/protocol/tower';

/** How each spell is named on screen (docs/tower/planning/power-ups.md). */
export const SPELL_LABEL: Record<Spell, { icon: string; name: string; effect: string }> = {
  fog: {
    icon: '🌫️',
    name: 'Fog',
    effect: `hides the top of their tower for ${SPELL_TUNING.fogMs / 1000}s`,
  },
  magpie: { icon: '🐦‍⬛', name: 'Magpie', effect: 'flies off with the top piece of their tower' },
  pigeon: {
    icon: '🐦',
    name: 'Pigeon',
    effect: `${SPELL_TUNING.pigeons} pigeons perch on the edges of their top pieces and tip them`,
  },
  shaky: {
    icon: '〰️',
    name: 'Shaky hand',
    effect: `their drawer's lines wobble for ${SPELL_TUNING.shakyMs / 1000}s`,
  },
};
