import { useIdentity } from '../../../lib/identity';
import { useUpdateIdentityInRoom } from '../api';
import { IdentityChip } from './IdentityChip';

/**
 * The room header's "you" button: change your name or drawing at any time, even mid-match. Saving
 * updates everyone's player list (PUT /api/rooms/:code/me) without reconnecting.
 */
export function RoomIdentityChip({ roomCode }: { roomCode: string }) {
  const identity = useIdentity((s) => s.identity);
  const update = useUpdateIdentityInRoom(roomCode);
  if (!identity) return null;
  return (
    <IdentityChip
      compact
      identity={identity}
      onSaved={({ displayName, avatar }) => update.mutate({ displayName, avatar })}
    />
  );
}
