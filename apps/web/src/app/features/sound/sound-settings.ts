import { create } from 'zustand';
import { SOUND_GROUPS, type SoundGroup } from './sound-catalog';

/**
 * The player's sound preferences, remembered in this browser (a per-viewer convenience).
 * Storage can be unavailable (private mode, blocked site data), so every access is guarded.
 */

export type GroupSetting = { on: boolean; volume: number };

export type SoundSettings = {
  muted: boolean;
  /** 0–1. */
  master: number;
  groups: Record<SoundGroup, GroupSetting>;
};

const STORAGE_KEY = 'pictiotheme.sound';

export const DEFAULT_SOUND_SETTINGS: SoundSettings = {
  muted: false,
  master: 0.8,
  groups: {
    game: { on: true, volume: 1 },
    guesses: { on: true, volume: 1 },
    drawing: { on: true, volume: 1 },
    // Ticking divides players, so it starts quieter.
    timer: { on: true, volume: 0.6 },
    room: { on: true, volume: 0.7 },
    // Background music: present but not pushy.
    music: { on: true, volume: 0.5 },
  },
};

function clamp01(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : fallback;
}

/** Reads stored settings, keeping defaults for anything missing or malformed. */
export function parseSoundSettings(raw: unknown): SoundSettings {
  const d = DEFAULT_SOUND_SETTINGS;
  if (typeof raw !== 'object' || raw === null) return d;
  const r = raw as Partial<Record<keyof SoundSettings, unknown>>;
  const groups = (typeof r.groups === 'object' && r.groups !== null ? r.groups : {}) as Record<
    string,
    Partial<GroupSetting> | undefined
  >;
  return {
    muted: typeof r.muted === 'boolean' ? r.muted : d.muted,
    master: clamp01(r.master, d.master),
    groups: Object.fromEntries(
      SOUND_GROUPS.map(({ id }) => {
        const g = groups[id];
        return [
          id,
          {
            on: typeof g?.on === 'boolean' ? g.on : d.groups[id].on,
            volume: clamp01(g?.volume, d.groups[id].volume),
          },
        ];
      }),
    ) as Record<SoundGroup, GroupSetting>,
  };
}

function load(): SoundSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return parseSoundSettings(raw ? JSON.parse(raw) : null);
  } catch {
    return DEFAULT_SOUND_SETTINGS;
  }
}

function save(settings: SoundSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Not persisted; the settings still apply in this tab.
  }
}

/** The gain a group plays at: 0 when muted or switched off. */
export function groupGain(settings: SoundSettings, group: SoundGroup): number {
  const g = settings.groups[group];
  return settings.muted || !g.on ? 0 : settings.master * g.volume;
}

type SoundSettingsStore = SoundSettings & {
  setMuted: (muted: boolean) => void;
  setMaster: (volume: number) => void;
  setGroup: (group: SoundGroup, patch: Partial<GroupSetting>) => void;
};

export const useSoundSettings = create<SoundSettingsStore>((set, get) => {
  const update = (patch: Partial<SoundSettings>) => {
    set(patch);
    const { muted, master, groups } = get();
    save({ muted, master, groups });
  };
  return {
    ...load(),
    setMuted: (muted) => update({ muted }),
    // Turning the volume up unmutes, like a system volume slider.
    setMaster: (master) => update({ master, ...(master > 0 ? { muted: false } : {}) }),
    setGroup: (group, patch) =>
      update({ groups: { ...get().groups, [group]: { ...get().groups[group], ...patch } } }),
  };
});
