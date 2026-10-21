import type { CSSProperties } from 'react';
import { useIdentity } from '../identity-store';
import { useUpdateIdentityInRoom } from '../api';
import { IdentityChip } from './IdentityChip';

/**
 * The room header's "you" button: change your name or drawing at any time, even mid-match (then
 * it's `avatarOnly`, just your doodle). Saving updates your profile in every game and everyone's
 * player list here (PUT /api/rooms/:code/me) without reconnecting.
 */
export function RoomIdentityChip({
  roomCode,
  nameStyle,
  avatarOnly = false,
}: {
  roomCode: string;
  nameStyle?: CSSProperties;
  avatarOnly?: boolean;
}) {
  const identity = useIdentity((s) => s.identity);
  const update = useUpdateIdentityInRoom(roomCode);
  if (!identity) return null;
  return (
    <IdentityChip
      compact
      avatarOnly={avatarOnly}
      nameStyle={nameStyle}
      identity={identity}
      onSaved={({ displayName, avatar }) => update.mutate({ displayName, avatar })}
    />
  );
}
