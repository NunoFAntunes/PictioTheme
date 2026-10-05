import { AvatarImage, DisplayName } from '@pictiotheme/protocol';
import { create } from 'zustand';

/**
 * The guest's chosen name and drawn avatar (a PNG data URL), remembered in this browser (a per-viewer convenience).
 * Storage can be unavailable (private mode, blocked site data), so every access is guarded.
 */

/**
 * `cutout` marks an avatar saved as a transparent doodle. Older ones were drawn on a white square;
 * features/identity re-cuts those once (AvatarUpgrade).
 */
export type Identity = { displayName: string; avatar: AvatarImage; cutout?: true };

const STORAGE_KEY = 'pictiotheme.identity';

function load(): Identity | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { displayName?: unknown; avatar?: unknown; cutout?: unknown };
    const name = DisplayName.safeParse(parsed.displayName);
    const avatar = AvatarImage.safeParse(parsed.avatar);
    if (!name.success || !avatar.success) return null;
    return parsed.cutout === true
      ? { displayName: name.data, avatar: avatar.data, cutout: true }
      : { displayName: name.data, avatar: avatar.data };
  } catch {
    return null;
  }
}

function save(identity: Identity): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
  } catch {
    // Not persisted; the identity still works for this tab.
  }
}

type IdentityStore = {
  identity: Identity | null;
  setIdentity: (identity: Identity) => void;
};

export const useIdentity = create<IdentityStore>((set) => ({
  identity: load(),
  setIdentity(identity) {
    save(identity);
    set({ identity });
  },
}));
