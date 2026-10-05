import type { Identity } from '../../lib/identity';
import { initialAvatar } from '../avatar';

/** True while the avatar is still the initial made from the name (the player never drew one). */
export function hasGeneratedAvatar(identity: Identity): boolean {
  return identity.avatar === initialAvatar(identity.displayName);
}
