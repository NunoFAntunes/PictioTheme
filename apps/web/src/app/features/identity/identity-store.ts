import {
  createGameIdentity,
  importLegacyProfile,
  saveProfile,
  type SaveResult,
} from '@pictiotheme/account';
import { AvatarImage, DisplayName } from '@pictiotheme/protocol';
import { isSillyName } from '../../lib/silly-name';
import { initialAvatar, recutAvatar } from '../avatar';

/**
 * Who you play as: your name and avatar (a PNG data URL), from the profile you share with every
 * game (`@pictiotheme/account`, docs/technical/decisions.md D13). The avatar is your drawing, or
 * your initial when you haven't drawn one; the initial follows your name.
 */
export type Identity = { displayName: string; avatar: AvatarImage };

const game = createGameIdentity({
  fallbackAvatar: initialAvatar,
  actions: ({ fallbackFor }) => ({
    /**
     * Saves a name you picked, and the avatar: a drawing, or your initial (stored as no drawing).
     * It shows at once; the result says if the server refused it.
     */
    setIdentity: ({ displayName, avatar }: Identity): Promise<SaveResult> =>
      saveProfile({
        displayName,
        drawing: avatar === fallbackFor(displayName) ? null : avatar,
      }),
  }),
});

export const useIdentity = game.useIdentity;
/** The initial for a name, made once (drawing it on a canvas is not free). */
export const initialFor = game.fallbackFor;
/** True while the avatar is still the initial made from the name (the player never drew one). */
export const hasGeneratedAvatar = game.isFallback;

/**
 * Before profiles were shared, this browser kept the identity itself (`pictiotheme.identity`).
 * It moves into the profile once, if the profile is still empty. Avatars from before they were
 * transparent doodles are cut out on the way.
 */
const LEGACY_KEY = 'pictiotheme.identity';

async function readLegacy() {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { displayName?: unknown; avatar?: unknown; cutout?: unknown };
    const name = DisplayName.safeParse(parsed.displayName);
    const avatar = AvatarImage.safeParse(parsed.avatar);
    if (!name.success || !avatar.success) return null;
    const drawn = avatar.data !== initialFor(name.data);
    const drawing = !drawn
      ? null
      : parsed.cutout === true
        ? avatar.data
        : ((await recutAvatar(avatar.data)) ?? avatar.data);
    return { displayName: name.data, nameChosen: !isSillyName(name.data), drawing };
  } catch {
    return null;
  }
}

let imported: Promise<void> | null = null;
export function importLegacyIdentity(): Promise<void> {
  imported ??= importLegacyProfile(readLegacy, () => {
    try {
      localStorage.removeItem(LEGACY_KEY);
    } catch {
      // Stays; it's only read while the profile is empty.
    }
  });
  return imported;
}
