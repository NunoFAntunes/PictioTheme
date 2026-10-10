import { create } from 'zustand';
import { useRoomStore } from '../../realtime';

/**
 * Shared UI state for crumpling the room away. `mine`: this tab's host closed the room (the
 * header's button starts it; afterwards the page goes home). `done`: the ball is gone, so a guest
 * can be told the room has closed.
 */
export const useCrumple = create<{ mine: boolean; done: boolean }>(() => ({
  mine: false,
  done: false,
}));

export function crumpleRoom(): void {
  useCrumple.setState({ mine: true });
}

/** For a new room: nothing crumpled yet. */
export function resetCrumple(): void {
  useCrumple.setState({ mine: false, done: false });
}

/** Whether the host (this tab or another) closed the room, so it's crumpled away. */
export function useClosing(): boolean {
  const mine = useCrumple((s) => s.mine);
  const closedByHost = useRoomStore(
    (s) => s.connection.kind === 'closed' && s.connection.reason === 'closed_by_host',
  );
  return mine || closedByHost;
}

/**
 * Whether the room stays on screen although it's closed: while it's crumpled away. The host's
 * page then goes home; guests are told "The host closed this room." once the ball is gone.
 */
export function useCrumpling(): boolean {
  const closing = useClosing();
  const mine = useCrumple((s) => s.mine);
  const done = useCrumple((s) => s.done);
  // The host's page keeps the room up until it has gone home.
  return closing && (mine || !done);
}
