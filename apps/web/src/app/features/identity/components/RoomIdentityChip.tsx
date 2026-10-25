import { PlayerSticker } from '@pictiotheme/account/ui';
import type { CSSProperties } from 'react';
import { PORTAL_URL } from '../../../lib/portal';
import { initialFor } from '../identity-store';

/** Your initial until you draw yourself (identity-store.ts). */
export const fallbackAvatar = (name: string | null) => initialFor(name ?? '?') ?? '';

/**
 * The room header's "you" sticker (screens.md §4): the sticker every game shares, in sun yellow
 * with a YOU tag and your name in `nameStyle` (the hand the player list writes it in), or just
 * your doodle (`avatarOnly`) while a match is on. It changes your name or drawing at any time:
 * saving updates your profile in every game, and the room follows it
 * (`useFollowIdentityInRoom`).
 */
export function RoomIdentityChip({
  nameStyle,
  avatarOnly = false,
}: {
  nameStyle?: CSSProperties;
  avatarOnly?: boolean;
}) {
  return (
    <PlayerSticker
      look={avatarOnly ? 'avatar' : 'room'}
      nameStyle={nameStyle}
      fallbackAvatar={fallbackAvatar}
      portalUrl={PORTAL_URL}
    />
  );
}
