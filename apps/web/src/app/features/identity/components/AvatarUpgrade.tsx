import { useEffect } from 'react';
import { useIdentity } from '../../../lib/identity';
import { recutAvatar } from '../../avatar';

/**
 * Avatars saved before they became transparent doodles were drawn on a white square. This cuts
 * the doodle out once, so the player is their drawing in rooms. Renders nothing.
 */
export function AvatarUpgrade() {
  const identity = useIdentity((s) => s.identity);
  const setIdentity = useIdentity((s) => s.setIdentity);

  useEffect(() => {
    if (!identity || identity.cutout) return;
    let cancelled = false;
    void recutAvatar(identity.avatar).then((avatar) => {
      if (cancelled) return;
      // Keep the old picture if it can't be re-cut; only stop trying.
      setIdentity({ ...identity, avatar: avatar ?? identity.avatar, cutout: true });
    });
    return () => {
      cancelled = true;
    };
  }, [identity, setIdentity]);

  return null;
}
