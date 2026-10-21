import { initialFor, type Identity } from './identity-store';

/** True while the avatar is still the initial made from the name (the player never drew one). */
export function hasGeneratedAvatar(identity: Identity): boolean {
  return identity.avatar === initialFor(identity.displayName);
}
