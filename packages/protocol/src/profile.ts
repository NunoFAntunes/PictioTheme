import type { UpdateProfileRequest } from './http';

/**
 * The profile's name rule, shared by the server (players.service.ts) and the browser's optimistic
 * copy (`@pictiotheme/account`), so both always agree (docs/technical/decisions.md D13).
 */

export type ProfileName = { displayName: string | null; nameChosen: boolean };

/**
 * The name after a change. `nameChosen` defaults to true with a `displayName`; a made-up name
 * (`nameChosen: false`) never replaces a chosen one, so a game that names a newcomer can't undo a
 * name picked in another game.
 */
export function nameAfter(current: ProfileName, patch: UpdateProfileRequest): ProfileName {
  if (patch.displayName === undefined) return current;
  const chosen = patch.nameChosen ?? true;
  if (!chosen && current.nameChosen) return current;
  return { displayName: patch.displayName, nameChosen: chosen };
}
