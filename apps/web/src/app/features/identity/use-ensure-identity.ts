import { useEffect } from 'react';
import { useIdentity, type Identity } from '../../lib/identity';
import { sillyName } from '../../lib/silly-name';
import { initialAvatar } from '../avatar';

/**
 * The player's identity, made up on the first visit so nobody fills in a form before playing
 * (user-flows.md §2): a silly name and its initial as the avatar. Null only for that first render.
 */
export function useEnsureIdentity(): Identity | null {
  const identity = useIdentity((s) => s.identity);
  const setIdentity = useIdentity((s) => s.setIdentity);

  useEffect(() => {
    if (identity) return;
    const displayName = sillyName();
    const avatar = initialAvatar(displayName);
    // initialAvatar is already transparent, so it's a cut-out (AvatarUpgrade leaves it alone).
    if (avatar) setIdentity({ displayName, avatar, cutout: true });
  }, [identity, setIdentity]);

  return identity;
}
