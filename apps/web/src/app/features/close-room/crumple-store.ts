import { create } from 'zustand';

/**
 * Whether the host has closed the room and it's being crumpled away. Shared UI state: the header's
 * button starts it, the room page keeps showing the room (not "You closed the room.") until the
 * ball is gone and the page has gone home.
 */
export const useCrumple = create<{ crumpling: boolean }>(() => ({ crumpling: false }));

export function crumpleRoom(): void {
  useCrumple.setState({ crumpling: true });
}
