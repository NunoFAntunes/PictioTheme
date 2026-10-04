import { useEffect } from 'react';
import { deviceKind } from '../../../lib/device';
import { landingInfo, sendEvent } from '../../../lib/events';
import { useRoomStore } from '../../../realtime';

/**
 * Sends the room's browser-side metrics (docs/technical/data-model.md#metrics): the device when
 * the player joins a room (once per room per tab), and how long after landing the tab's first
 * turn started (once per tab). Renders nothing.
 */

let firstTurnSent = false;
const joinedRooms = new Set<string>();

export function RoomMetrics() {
  const code = useRoomStore((s) => s.view?.code ?? null);
  const inTurn = useRoomStore((s) => {
    const kind = s.view?.phase.kind;
    return kind === 'choosing' || kind === 'drawing';
  });

  useEffect(() => {
    if (code === null || joinedRooms.has(code)) return;
    joinedRooms.add(code);
    sendEvent({ name: 'room_joined', device: deviceKind() });
  }, [code]);

  useEffect(() => {
    if (!inTurn || firstTurnSent) return;
    firstTurnSent = true;
    sendEvent({ name: 'first_turn', ...landingInfo() });
  }, [inTurn]);

  return null;
}
