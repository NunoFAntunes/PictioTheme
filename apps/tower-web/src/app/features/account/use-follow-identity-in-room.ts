import { useRoomFollowsIdentity } from '@pictiotheme/account';
import type { PlayerIdentity } from '@pictiotheme/protocol';
import { useCallback } from 'react';
import { useIdentity } from '../../lib/identity';
import { updateIdentityInRoom } from './api';

/**
 * While you're in the room, your name and avatar there follow your profile, wherever you change
 * it: the account widget, another game or the portal (decisions.md D13). Everyone's crew list
 * updates without a reconnect (PUT /api/tower/rooms/:code/me).
 */
export function useFollowIdentityInRoom(code: string): void {
  const identity = useIdentity((s) => s.identity);
  const push = useCallback((next: PlayerIdentity) => updateIdentityInRoom(code, next), [code]);
  useRoomFollowsIdentity(identity, push);
}
