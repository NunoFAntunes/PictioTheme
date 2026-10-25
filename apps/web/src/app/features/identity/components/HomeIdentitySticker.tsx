import { PlayerSticker } from '@pictiotheme/account/ui';
import { PORTAL_URL } from '../../../lib/portal';
import { hasGeneratedAvatar } from '../identity-store';
import { useEnsureIdentity, useNameChosen } from '../use-ensure-identity';
import { fallbackAvatar } from './RoomIdentityChip';

/**
 * Your "you" sticker in the home page's top-left corner (screens.md §1): the sticker every game
 * shares, white, "Playing as guest" over your name. A click changes your name and drawing, for
 * every game. While you're still a plain letter or a made-up name, a note beside it points at it
 * asking you to introduce yourself. Before it, a "← Games" chip back to the portal.
 */
export function HomeIdentitySticker() {
  const identity = useEnsureIdentity();
  const nameChosen = useNameChosen();
  if (!identity) return null;
  return (
    <PlayerSticker
      fallbackAvatar={fallbackAvatar}
      portalUrl={PORTAL_URL}
      portalLink
      nudge={hasGeneratedAvatar(identity) || !nameChosen}
    />
  );
}
