import { useEffect, useRef, useState } from 'react';
import { playSound, type SoundId } from '../sound';
import { BEAT_ORDER, BEATS, type Beat } from './ceremony';

/** What a beat can schedule: work and sounds, `ms` after the beat starts. Skipping cancels both. */
export type Cue = {
  later: (ms: number, fn: () => void) => void;
  sound: (id: SoundId, ms?: number) => void;
};

/**
 * Runs the podium ceremony's beats on timers. `reached` is the latest beat so far (null before the
 * first), and `idle` once the show is over or skipped; without an intro it starts there.
 */
export function useCeremony(intro: boolean, onBeat: (beat: Beat, cue: Cue) => void) {
  const [reached, setReached] = useState<Beat | null>(intro ? null : 'idle');
  const [skipped, setSkipped] = useState(!intro);
  // The latest handler, so the timers (set once) see the current players.
  const handler = useRef(onBeat);
  useEffect(() => {
    handler.current = onBeat;
  });

  useEffect(() => {
    if (skipped) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const stops: (() => void)[] = [];
    const cue: Cue = {
      later: (ms, fn) => timers.push(setTimeout(fn, ms)),
      sound: (id, ms = 0) =>
        cue.later(ms, () => {
          const stop = playSound(id);
          if (stop) stops.push(stop);
        }),
    };
    for (const beat of BEAT_ORDER) {
      cue.later(BEATS[beat], () => {
        setReached(beat);
        handler.current(beat, cue);
      });
    }
    return () => {
      timers.forEach(clearTimeout);
      stops.forEach((stop) => stop());
    };
  }, [skipped]);

  const at = (beat: Beat) =>
    reached !== null && BEAT_ORDER.indexOf(reached) >= BEAT_ORDER.indexOf(beat);
  return {
    /** Whether the show has got to this beat (always, once settled). */
    at,
    /** Over or skipped: everyone stands in place, celebrating, and can be poked. */
    settled: reached === 'idle',
    /** The beat playing now (null when settled). */
    reached,
    skip: () => {
      setSkipped(true);
      setReached('idle');
    },
  };
}
