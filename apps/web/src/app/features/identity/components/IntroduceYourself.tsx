/**
 * A note scribbled on the home page beside your "you" sticker while you're still a plain letter
 * (screens.md §1): a loopy arrow back at the sticker and "Psst! Introduce yourself!". It draws itself
 * in once the intro has played. Decorative: the sticker reads it out through `id`.
 */
export function IntroduceYourself({ id }: { id: string }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none -mt-1 flex items-start text-ink select-none"
      data-testid="introduce-yourself"
    >
      <svg viewBox="0 0 120 64" className="mt-1 w-24 shrink-0 overflow-visible">
        <g
          fill="none"
          stroke="currentColor"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* From the words, a loop, then on to the sticker. */}
          <path
            pathLength={1}
            d="M116 46C100 56 80 54 75 42 71 31 84 24 89 33 94 44 72 53 54 46 38 40 25 30 9 20"
            className="[stroke-dasharray:1] motion-safe:animate-squiggle-draw"
            style={{ animationDelay: '1.9s' }}
          />
          <path
            pathLength={1}
            d="M21 14 8 19.5 15 32"
            className="[stroke-dasharray:1] motion-safe:animate-squiggle-draw"
            style={{ animationDelay: '2.4s' }}
          />
        </g>
      </svg>
      <p
        id={id}
        className="mt-4 rotate-2 text-left font-hand leading-none motion-safe:animate-note-drop"
        style={{ animationDelay: '2.5s' }}
      >
        <span className="block text-2xl text-pop-tomato">Psst! Introduce yourself!</span>
        <span className="block pl-3 text-base text-ink/70">(draw your face, we won’t judge)</span>
      </p>
    </div>
  );
}
