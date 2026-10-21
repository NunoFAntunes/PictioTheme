import { createGameIdentity, importLegacyProfile, saveProfile } from '@pictiotheme/account';
import { AvatarImage, DisplayName, type PlayerIdentity } from '@pictiotheme/protocol';
import { makeAvatar } from './avatar';

/**
 * The player's name and avatar: the profile shared with every game (`@pictiotheme/account`,
 * docs/technical/decisions.md D13), so a name or drawing picked in DoodleWhirl or on the portal
 * is yours here too.
 *
 * The avatar is the one the player drew (`drawn`), or else the bobble hat made from their name.
 * A drawing can be saved before there's a name: it's kept and used once there is one.
 */

const game = createGameIdentity({
  fallbackAvatar: makeAvatar,
  actions: ({ get, fallbackFor }) => ({
    /** Sets the name; the avatar is the drawing, or the bobble hat made from the name. */
    setName: (displayName: string): PlayerIdentity => {
      const name = displayName.trim();
      // Shows at once (saveProfile updates the profile before the server answers).
      void saveProfile({ displayName: name });
      return get().identity ?? { displayName: name, avatar: fallbackFor(name) ?? makeAvatar(name) };
    },
    /** Keeps a new drawing (or drops it, for the bobble hat again). */
    setDrawing: (drawn: AvatarImage | null): void => {
      void saveProfile({ drawing: drawn });
    },
  }),
});

/** `identity`, `drawn` (the drawing, if they drew one), `setName` and `setDrawing`. */
export const useIdentity = game.useIdentity;
/** The bobble hat for a name, made once (drawing it on a canvas is not free). */
export const hatFor = (name: string): string => game.fallbackFor(name) ?? makeAvatar(name);

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
