import type { RushWindow } from '@pictiotheme/protocol';
import { useEffect, useRef } from 'react';
import { serverNow } from '../../../realtime';

/**
 * Rush mode, once someone has guessed (game-rules.md#rush): a bar drains with the time left, and
 * shows what a correct guess is worth right now (before the order bonus). Players who already know
 * the word only see the bar. It is redrawn every frame from the server clock, without re-rendering.
 */
export function RushMeter({
  rush,
  endsAt,
  paused,
  showPoints,
}: {
  rush: RushWindow;
  endsAt: number;
  paused: boolean;
  showPoints: boolean;
}) {
  const fill = useRef<HTMLDivElement>(null);
  const points = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let frame = 0;
    const draw = () => {
      const share = Math.min(1, Math.max(0, (endsAt - serverNow()) / rush.windowMs));
      if (fill.current) {
        fill.current.style.width = `${share * 100}%`;
        fill.current.style.backgroundColor =
          share < 0.25 ? 'var(--color-pop-tomato)' : 'var(--color-pop-sun)';
      }
      if (points.current) {
        const now = rush.toPoints + (rush.fromPoints - rush.toPoints) * share;
        points.current.textContent = `+${Math.round(now)}`;
      }
      // Paused: drawn once, frozen until the resume re-sends the deadline.
      if (!paused && share > 0) frame = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, [rush, endsAt, paused]);

  return (
    <div
      className="flex items-center gap-2 motion-safe:animate-sticker-pop"
      data-testid="rush-meter"
    >
      <span className="font-logo text-sm text-ink" aria-hidden="true">
        ⚡ Rush
      </span>
      <div
        className="relative h-3.5 w-40 overflow-hidden rounded-[0.6em_0.2em_0.6em_0.25em] border-2 border-ink bg-paper"
        aria-hidden="true"
      >
        <div ref={fill} className="absolute inset-y-0 left-0" />
      </div>
      {showPoints && (
        <span ref={points} className="w-10 text-sm font-semibold tabular-nums" aria-hidden="true" />
      )}
      <span className="sr-only">
        Rush: someone guessed it.{' '}
        {showPoints ? 'Points drop until the time runs out.' : 'The others are racing the clock.'}
      </span>
    </div>
  );
}
