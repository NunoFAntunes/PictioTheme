import { AvatarImage, DisplayName } from '@pictiotheme/protocol';
import { create } from 'zustand';

/**
 * The guest's chosen name and drawn avatar (a PNG data URL), remembered in this browser (a per-viewer convenience).
 * Storage can be unavailable (private mode, blocked site data), so every access is guarded.
 */

export type Identity = { displayName: string; avatar: AvatarImage };

const STORAGE_KEY = 'pictiotheme.identity';

function load(): Identity | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { displayName?: unknown; avatar?: unknown };
    const name = DisplayName.safeParse(parsed.displayName);
    const avatar = AvatarImage.safeParse(parsed.avatar);
    return name.success && avatar.success ? { displayName: name.data, avatar: avatar.data } : null;
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
