import type { CSSProperties } from 'react';
import { useIdentity } from '../identity-store';
import { IdentityChip } from './IdentityChip';

/**
 * The room header's "you" button: change your name or drawing at any time, even mid-match (then
 * it's `avatarOnly`, just your doodle). Saving updates your profile in every game, and the room
 * follows it (`useFollowIdentityInRoom`).
 */
export function RoomIdentityChip({
  nameStyle,
  avatarOnly = false,
}: {
  nameStyle?: CSSProperties;
  avatarOnly?: boolean;
}) {
  const identity = useIdentity((s) => s.identity);
  if (!identity) return null;
  return <IdentityChip compact avatarOnly={avatarOnly} nameStyle={nameStyle} identity={identity} />;
}
