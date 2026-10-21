import { accountStore, importLegacyProfile, saveProfile } from '@pictiotheme/account';
import { AvatarImage, DisplayName, type PlayerIdentity, type Profile } from '@pictiotheme/protocol';
import { create } from 'zustand';
import { makeAvatar } from './avatar';

/**
 * The player's name and avatar: the profile shared with every game (`@pictiotheme/account`,
 * docs/technical/decisions.md D13), so a name or drawing picked in DoodleWhirl or on the portal
 * is yours here too.
 *
 * The avatar is the one the player drew (`drawn`), or else the bobble hat made from their name.
 * A drawing can be saved before there's a name: it's kept and used once there is one.
 */

const hats = new Map<string, string>();
/** The bobble hat for a name, made once (drawing it on a canvas is not free). */
export function hatFor(name: string): string {
  let hat = hats.get(name);
  if (!hat) {
    hat = makeAvatar(name);
    hats.set(name, hat);
  }
  return hat;
}

function stateOf(profile: Profile | null) {
  const drawn = profile?.drawing ?? null;
  const name = profile?.displayName ?? null;
  return {
    identity: name ? { displayName: name, avatar: drawn ?? hatFor(name) } : null,
    drawn,
  };
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

export const useIdentity = create<IdentityStore>((_set, get) => ({
  ...stateOf(accountStore.getState().profile),
  setName(displayName) {
    const name = displayName.trim();
    // Shows at once (saveProfile updates the profile before the server answers).
    void saveProfile({ displayName: name });
    return get().identity ?? { displayName: name, avatar: hatFor(name) };
  },
  setDrawing(drawn) {
    void saveProfile({ drawing: drawn });
  },
}));

accountStore.subscribe(({ profile }) => useIdentity.setState(stateOf(profile)));

export const isValidName = (name: string) => DisplayName.safeParse(name).success;

/**
 * Before profiles were shared, this browser kept the identity itself (`doodle-tower.identity`).
 * It moves into the profile once, if the profile has no name of its own yet.
 */
const LEGACY_KEY = 'doodle-tower.identity';

function readLegacy() {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { displayName?: unknown; avatar?: unknown; drawn?: unknown };
    const name = DisplayName.safeParse(parsed.displayName);
    const avatar = AvatarImage.safeParse(parsed.avatar);
    const drawing = parsed.drawn === true && avatar.success ? avatar.data : null;
    if (name.success) return { displayName: name.data, drawing };
    return drawing ? { drawing } : null;
  } catch {
    return null;
  }
}

if (typeof window !== 'undefined') {
  void importLegacyProfile(readLegacy, () => {
    try {
      localStorage.removeItem(LEGACY_KEY);
    } catch {
      // Stays; it's only read while the profile has no name.
    }
  });
}
