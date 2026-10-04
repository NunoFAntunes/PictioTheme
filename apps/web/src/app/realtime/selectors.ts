import type { PlayerId, PublicPhase, PublicPlayer } from '@pictiotheme/protocol';
import { useEffect, useState } from 'react';
import { serverNow } from './room-store';
import type { RoomView } from './room-view';

/** Small read helpers over the room view, shared by the in-room features. */

export function drawerIdOf(phase: PublicPhase): PlayerId | null {
  return phase.kind === 'choosing' || phase.kind === 'drawing' ? phase.drawerId : null;
}

export function playerById(view: RoomView, id: PlayerId): PublicPlayer | undefined {
  return view.players.find((p) => p.id === id);
}

export function playerName(view: RoomView, id: PlayerId): string {
  return playerById(view, id)?.name ?? 'Someone';
}

export function amHost(view: RoomView): boolean {
  return playerById(view, view.you)?.isHost === true;
}

export function isInMatch(phase: PublicPhase): boolean {
  return phase.kind === 'choosing' || phase.kind === 'drawing' || phase.kind === 'reveal';
}

/** Seconds left until `endsAt` on the server clock, refreshed 4×/s. Null without a deadline. */
export function useSecondsLeft(endsAt: number | null): number | null {
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    if (endsAt === null) return;
    const timer = setInterval(() => setNow(serverNow()), 250);
    return () => clearInterval(timer);
  }, [endsAt]);
  return endsAt === null ? null : Math.max(0, Math.ceil((endsAt - now) / 1000));
}

/** Re-renders every `ms` (for fading guess bubbles). */
export function useNow(ms: number): number {
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    const timer = setInterval(() => setNow(serverNow()), ms);
    return () => clearInterval(timer);
  }, [ms]);
  return now;
}
