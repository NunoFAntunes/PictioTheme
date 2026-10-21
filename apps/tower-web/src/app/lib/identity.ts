import { AvatarImage, DisplayName, type PlayerIdentity } from '@pictiotheme/protocol';
import { create } from 'zustand';
import { makeAvatar } from './avatar';

/**
 * The player's name and avatar, remembered in this browser (a per-viewer convenience). Storage
 * can be unavailable (private mode, blocked site data), so every access is guarded.
 *
 * The avatar is the one the player drew (`drawn`), or else the bobble hat made from their name.
 * A drawing can be saved before there's a valid name: it's kept and used once there is one.
 */

const STORAGE_KEY = 'doodle-tower.identity';

type Saved = { displayName?: unknown; avatar?: unknown; drawn?: unknown };

function load(): { identity: PlayerIdentity | null; drawn: AvatarImage | null } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { identity: null, drawn: null };
    const parsed = JSON.parse(raw) as Saved;
    const name = DisplayName.safeParse(parsed.displayName);
    const avatar = AvatarImage.safeParse(parsed.avatar);
    if (!avatar.success) return { identity: null, drawn: null };
    return {
      identity: name.success ? { displayName: name.data, avatar: avatar.data } : null,
      drawn: parsed.drawn === true ? avatar.data : null,
    };
  } catch {
    return { identity: null, drawn: null };
  }
}

function save(identity: PlayerIdentity | null, drawn: AvatarImage | null): void {
  const saved = identity ? { ...identity, drawn: drawn !== null } : { avatar: drawn, drawn: true };
  try {
    if (identity || drawn) localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Not persisted; it still works for this tab.
  }
}

type IdentityStore = {
  identity: PlayerIdentity | null;
  /** The avatar the player drew, if they did. */
  drawn: AvatarImage | null;
  /** Sets the name; the avatar is the drawing, or the bobble hat made from the name. */
  setName: (displayName: string) => PlayerIdentity;
  /** Keeps a new drawing (or drops it, for the bobble hat again). */
  setDrawing: (avatar: AvatarImage | null) => void;
};

export const useIdentity = create<IdentityStore>((set, get) => ({
  ...load(),
  setName(displayName) {
    const name = displayName.trim();
    const { drawn } = get();
    const identity = { displayName: name, avatar: drawn ?? makeAvatar(name) };
    save(identity, drawn);
    set({ identity });
    return identity;
  },
  setDrawing(drawn) {
    const current = get().identity;
    const identity = current && {
      displayName: current.displayName,
      avatar: drawn ?? makeAvatar(current.displayName),
    };
    save(identity, drawn);
    set({ identity, drawn });
  },
}));

export const isValidName = (name: string) => DisplayName.safeParse(name).success;
