import type { AvatarImage, PlayerIdentity, Profile } from '@pictiotheme/protocol';
import { useEffect, useRef } from 'react';
import { create } from 'zustand';
import { accountStore } from './account-store';

/**
 * A game's view of the profile (docs/technical/decisions.md D13): the name and avatar it plays
 * with. The avatar is the player's drawing, or else the game's own fallback made from the name
 * (DoodleWhirl's initial, Doodle Tower's bobble hat). Every game needs the same mirror of the
 * profile store, so it's made here; the game adds its own actions, which save with `saveProfile`.
 */

export type GameIdentityState = {
  /** Null until the profile has a name (or the fallback couldn't be drawn). */
  identity: PlayerIdentity | null;
  /** The drawing, if they drew one; null while the avatar is the fallback. */
  drawn: AvatarImage | null;
};

export function createGameIdentity<Actions extends object>(options: {
  /** The avatar before they draw themselves, made from the name. Made once per name. */
  fallbackAvatar: (name: string) => AvatarImage | null;
  /** The game's own actions (`setName`, …). */
  actions: (helpers: {
    get: () => GameIdentityState;
    fallbackFor: (name: string) => AvatarImage | null;
  }) => Actions;
}) {
  const fallbacks = new Map<string, AvatarImage | null>();
  /** Drawing the fallback on a canvas is not free, so each name's is kept. */
  const fallbackFor = (name: string): AvatarImage | null => {
    if (!fallbacks.has(name)) fallbacks.set(name, options.fallbackAvatar(name));
    return fallbacks.get(name) ?? null;
  };

  const stateOf = (profile: Profile | null): GameIdentityState => {
    const drawn = profile?.drawing ?? null;
    const name = profile?.displayName ?? null;
    const avatar = name === null ? null : (drawn ?? fallbackFor(name));
    return { identity: name && avatar ? { displayName: name, avatar } : null, drawn };
  };

  const useIdentity = create<GameIdentityState & Actions>((_set, get) => ({
    ...stateOf(accountStore.getState().profile),
    ...options.actions({ get, fallbackFor }),
  }));

  accountStore.subscribe(({ profile }) => {
    const next = stateOf(profile);
    const { identity, drawn } = useIdentity.getState();
    // The profile is set again on every sync; only a real change reaches the game.
    if (drawn === next.drawn && sameIdentity(identity, next.identity)) return;
    useIdentity.setState(next as Partial<GameIdentityState & Actions>);
  });

  /** True while the avatar is the fallback for the name (they haven't drawn themselves). */
  const isFallback = (identity: PlayerIdentity) =>
    identity.avatar === fallbackFor(identity.displayName);

  return { useIdentity, fallbackFor, isFallback };
}

function sameIdentity(a: PlayerIdentity | null, b: PlayerIdentity | null): boolean {
  return a === b || (!!a && !!b && a.displayName === b.displayName && a.avatar === b.avatar);
}

/**
 * Keeps the room you're in showing your current name and avatar (decisions.md D13), however it
 * changed: in this game's editor, or in another game or the portal (the profile is fetched again
 * when the tab comes back into view). The room got `identity` when you joined, and gets the latest
 * again on every rejoin, so only later changes are sent, with `push` (the game's
 * `PUT …/rooms/:code/me`). Best effort: a push that fails is carried by the next rejoin.
 */
export function useRoomFollowsIdentity(
  identity: PlayerIdentity | null,
  push: (identity: PlayerIdentity) => Promise<unknown>,
): void {
  const sent = useRef(identity);
  const pushRef = useRef(push);
  useEffect(() => {
    pushRef.current = push;
  }, [push]);

  useEffect(() => {
    if (!identity || sameIdentity(sent.current, identity)) return;
    sent.current = identity;
    void pushRef.current(identity).catch(() => {});
  }, [identity]);
}
