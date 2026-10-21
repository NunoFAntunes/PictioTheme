import { useRoomFollowsIdentity } from '@pictiotheme/account';
import { useCallback } from 'react';
import { updateIdentityInRoom } from './api';
import { useIdentity } from './identity-store';

/**
 * While you're in the room, your name and avatar there follow your profile, wherever you change
 * it: the room header's sticker, "Draw yourself!", another game or the portal (decisions.md D13).
 * Everyone's player list updates without a reconnect (PUT /api/rooms/:code/me).
 */
export function useFollowIdentityInRoom(code: string): void {
  const identity = useIdentity((s) => s.identity);
  const push = useCallback(
    (next: Parameters<typeof updateIdentityInRoom>[1]) => updateIdentityInRoom(code, next),
    [code],
  );
  useRoomFollowsIdentity(identity, push);
}
