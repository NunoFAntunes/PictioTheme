import { useEffect } from 'react';

/** --animate-chosen-card. A timer, not animationend, so it also goes away with reduced motion. */
const SHOW_MS = 2200;

/**
 * The drawer's card, large in the middle of the canvas as the drawing starts, so they're sure what
 * they're drawing (picked or dealt at random). It doesn't take clicks: they can start right away.
 */
export function ChosenCard({ word, onDone }: { word: string; onDone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, SHOW_MS);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div
      aria-hidden="true"
      // A size container, so the card fits a short canvas (phones) as well as a narrow one.
      className="pointer-events-none absolute inset-0 flex items-center justify-center p-4 [container-type:size]"
    >
      {/* The card is the container: its face's padding and text scale with the card. */}
      <div className="@container aspect-[3/4] w-[min(16rem,45cqw,55cqh)] animate-chosen-card rounded-xl border-4 border-brand-600 bg-white shadow-xl motion-reduce:animate-none dark:bg-zinc-900">
        <div className="flex size-full flex-col items-center justify-center gap-[6cqw] p-[8cqw] text-center">
          <span className="text-[8cqw] text-zinc-500">You're drawing</span>
          <span className="text-[15cqw] leading-tight font-bold text-balance break-words">
            {word}
          </span>
        </div>
      </div>
    </div>
  );
}
