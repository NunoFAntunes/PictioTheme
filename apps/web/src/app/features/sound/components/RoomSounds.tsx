import { useEffect, useRef } from 'react';
import { onRoomMessage, strokeModel, useRoomStore, useSecondsLeft } from '../../../realtime';
import { watchDrawing } from '../drawing-sounds';
import { soundsForMessage, tickFor } from '../room-sounds';
import { playSound, startLoop, type LoopVoice } from '../sound-engine';

/** Plays the room's event sounds, the drawing sounds and the turn clock. Renders nothing. */
export function RoomSounds() {
  useEffect(
    () =>
      onRoomMessage((msg, before, after) => {
        for (const id of soundsForMessage(msg, before, after)) playSound(id);
      }),
    [],
  );

  useEffect(() => {
    let pencil: LoopVoice | null = null;
    return watchDrawing(strokeModel, {
      scribble(level, tool) {
        pencil ??= startLoop('pencil');
        // The eraser rubs: slower and lower than the pencil.
        pencil?.set(
          level > 0 ? 0.35 + 0.65 * level : 0,
          tool === 'eraser' ? 0.7 : 0.9 + 0.25 * level,
        );
      },
      quiet() {
        pencil?.stop();
        pencil = null;
      },
      fill: () => playSound('fillGlug', { rate: 0.92 + Math.random() * 0.16 }),
    });
  }, []);

  const endsAt = useRoomStore((s) =>
    s.view?.phase.kind === 'drawing' && s.view.paused === null ? s.view.phase.endsAt : null,
  );
  const seconds = useSecondsLeft(endsAt);
  const lastTick = useRef<number | null>(null);
  useEffect(() => {
    if (seconds === null || seconds === lastTick.current) return;
    lastTick.current = seconds;
    const tick = tickFor(seconds);
    if (tick) playSound('clockTick', tick);
  }, [seconds]);

  return null;
}
