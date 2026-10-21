import type { Profile, UpdateProfileRequest } from '@pictiotheme/protocol';

/**
 * Pure profile rules, shared by the store's optimistic updates and mirrored by the server
 * (players.service.ts): a made-up name (`nameChosen: false`) never replaces a chosen one.
 */

/** Before the server has answered on a first visit. */
export const EMPTY_PROFILE: Profile = {
  playerId: '',
  kind: 'guest',
  displayName: null,
  nameChosen: false,
  drawing: null,
};

export function applyPatch(profile: Profile, patch: UpdateProfileRequest): Profile {
  const next = { ...profile };
  if (patch.displayName !== undefined) {
    const chosen = patch.nameChosen ?? true;
    if (chosen || !profile.nameChosen) {
      next.displayName = patch.displayName;
      next.nameChosen = chosen;
    }
  }
  if (patch.drawing !== undefined) next.drawing = patch.drawing;
  return next;
}

/** One change that does what `first` then `second` would. */
export function mergePatches(
  first: UpdateProfileRequest | null,
  second: UpdateProfileRequest,
): UpdateProfileRequest {
  if (!first) return second;
  const merged: UpdateProfileRequest = { ...first };
  if (second.displayName !== undefined) {
    const secondChosen = second.nameChosen ?? true;
    const firstChosen = first.displayName !== undefined && (first.nameChosen ?? true);
    if (secondChosen || !firstChosen) {
      merged.displayName = second.displayName;
      if (second.nameChosen === undefined) delete merged.nameChosen;
      else merged.nameChosen = second.nameChosen;
    }
  }
  if (second.drawing !== undefined) merged.drawing = second.drawing;
  return merged;
}

/**
 * What the account widget shows: `new` has no name yet ("Name yourself"), `named-for-you` plays
 * under a made-up name (still nudged to pick one), `guest` and `user` are named.
 */
export type AccountKind = 'new' | 'named-for-you' | 'guest' | 'user';

export function accountKindOf(profile: Profile): AccountKind {
  if (profile.displayName === null) return 'new';
  if (!profile.nameChosen) return 'named-for-you';
  return profile.kind;
}
