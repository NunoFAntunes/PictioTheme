import { create } from 'zustand';

/**
 * The sound control's settings, remembered in this browser (`doodletower.sound`, as JSON): mute
 * everything, and a volume (0–1) each for the music and the sound effects.
 */

const KEY = 'doodletower.sound';

type Levels = { muted: boolean; music: number; effects: number };

const DEFAULTS: Levels = { muted: false, music: 0.6, effects: 1 };

const level = (v: unknown, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : fallback;

function load(): Levels {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    if (!raw) return DEFAULTS;
    // Before the volumes, this was just 'muted' or 'on'.
    if (raw === 'muted' || raw === 'on') return { ...DEFAULTS, muted: raw === 'muted' };
    const saved = JSON.parse(raw) as Partial<Levels>;
    return {
      muted: saved.muted === true,
      music: level(saved.music, DEFAULTS.music),
      effects: level(saved.effects, DEFAULTS.effects),
    };
  } catch {
    return DEFAULTS;
  }
}

type SoundSettings = Levels & {
  toggle: () => void;
  setMusic: (volume: number) => void;
  setEffects: (volume: number) => void;
};

export const useSoundSettings = create<SoundSettings>((set, get) => {
  const save = (patch: Partial<Levels>) => {
    set(patch);
    const { muted, music, effects } = get();
    try {
      localStorage.setItem(KEY, JSON.stringify({ muted, music, effects }));
    } catch {
      // Private window: it just won't be remembered.
    }
  };
  return {
    ...load(),
    toggle: () => save({ muted: !get().muted }),
    // Turning a volume up unmutes: that's what the player is after.
    setMusic: (volume) => save({ music: level(volume, 0), ...(volume > 0 && { muted: false }) }),
    setEffects: (volume) =>
      save({ effects: level(volume, 0), ...(volume > 0 && { muted: false }) }),
  };
});
