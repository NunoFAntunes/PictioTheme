import { create } from 'zustand';
import type { RoomView } from './room-view';

/** Live room state for components. Written only by the connection (rule W5). */

export type ConnectionState =
  | { kind: 'connecting' }
  | { kind: 'open' }
  | { kind: 'reconnecting'; attempt: number }
  | { kind: 'closed'; reason: CloseReason; message: string };

export type CloseReason =
  'left' | 'not_found' | 'full' | 'kicked' | 'banned' | 'replaced' | 'room_closed' | 'lost';

type RoomStore = {
  view: RoomView | null;
  connection: ConnectionState;
  /** serverTime ≈ Date.now() + clockOffset (from ping/pong). */
  clockOffset: number;
};

export const useRoomStore = create<RoomStore>(() => ({
  view: null,
  connection: { kind: 'connecting' },
  clockOffset: 0,
}));

export function serverNow(): number {
  return Date.now() + useRoomStore.getState().clockOffset;
}
