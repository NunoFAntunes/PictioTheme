import { AvatarImage, DisplayName, type PlayerIdentity } from '@pictiotheme/protocol';
import { create } from 'zustand';
import { makeAvatar } from './avatar';

/**
 * The player's name and avatar, remembered in this browser (a per-viewer convenience). Storage
 * can be unavailable (private mode, blocked site data), so every access is guarded.
 */

const STORAGE_KEY = 'doodle-tower.identity';

function load(): PlayerIdentity | null {
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

type IdentityStore = {
  identity: PlayerIdentity | null;
  /** Sets the name; the avatar is drawn from it. */
  setName: (displayName: string) => PlayerIdentity;
};

export const useIdentity = create<IdentityStore>((set) => ({
  identity: load(),
  setName(displayName) {
    const identity = { displayName: displayName.trim(), avatar: makeAvatar(displayName) };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
    } catch {
      // Not persisted; it still works for this tab.
    }
    set({ identity });
    return identity;
  },
}));

export const isValidName = (name: string) => DisplayName.safeParse(name).success;
