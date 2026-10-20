import { useEffect, useRef } from 'react';
import { serverNow, type RoomView } from '../../realtime';
import { playGameCue } from './game-sounds';
import { countdownCue, roomCues } from './room-cues';

/** The room's sounds: its moments as they change, and the ticks of the last seconds. */
export function useRoomSounds(view: RoomView | null): void {
  const prev = useRef<RoomView | null>(null);
  useEffect(() => {
    if (view) for (const cue of roomCues(prev.current, view)) playGameCue(cue);
    prev.current = view;
  }, [view]);

  const playing = view?.phase === 'playing';
  useEffect(() => {
    if (!playing) return;
    let lastTick = '';
    const timer = setInterval(() => {
      const current = prev.current;
      if (current?.phase !== 'playing') return;
      const now = serverNow();
      const seconds = (at: number) => Math.ceil((at - now) / 1000);
      const placing = Object.values(current.crews).find(
        (c) => c.placing?.placerId === current.you,
      )?.placing;
      const match = current.matchEndsAt ? seconds(current.matchEndsAt) : 0;
      const place = placing ? seconds(placing.endsAt) : 0;
      // One tick per second of whichever clock is ticking (your placing's first).
      const placeCue = countdownCue(place, 3);
      const cue = placeCue ?? countdownCue(match, 10);
      const key = placeCue ? `place ${place}` : `match ${match}`;
      if (cue && key !== lastTick) playGameCue(cue);
      lastTick = key;
    }, 100);
    return () => clearInterval(timer);
  }, [playing]);
}
