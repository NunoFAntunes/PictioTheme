import { useRef, type CSSProperties } from 'react';
import { PencilBody, PencilTip } from './Pencil';
import { useLetterPhysics } from './use-letter-physics';

const NAME = 'DoodleWhirl!';
const WORDS = ['Doodle', 'Whirl!'];
const POPS = [
  'var(--color-pop-purple)',
  'var(--color-pop-tomato)',
  'var(--color-pop-sun)',
  'var(--color-pop-teal)',
  'var(--color-pop-pink)',
];

/** Each letter with its index across the whole name, its colour, and how it spins on the way in. */
const LETTERS = WORDS.map((word, w) =>
  [...word].map((char, c) => {
    const index = WORDS.slice(0, w).join('').length + c;
    return {
      char,
      index,
      color: POPS[index % POPS.length] ?? 'currentColor',
      spin: (index % 2 ? 1 : -1) * (25 + ((index * 37) % 50)),
    };
  }),
);

const PENCIL_LAYER =
  'pointer-events-none absolute bottom-[45%] left-[calc(100%-0.32em)] h-[0.22em] w-[2.2em] origin-left -rotate-[52deg] motion-safe:intro:animate-pencil-drop';

/**
 * The landing logo: sticker letters you can poke, grab and fling (they spring back home), a
 * pencil that has just finished the "!", and a swirl drawn under "Whirl!". The server-rendered
 * HTML is the finished picture; JS only adds the physics. In a room, StickerLogo is the same logo,
 * small: the shared `logo` view-transition name morphs one into the other (global.css).
 */
export function HeroLogo() {
  const container = useRef<HTMLDivElement>(null);
  const letters = useRef<Array<HTMLSpanElement | null>>([]);
  useLetterPhysics(container, letters);

  return (
    <div ref={container} className="relative">
      <h1 className="relative isolate font-logo text-[clamp(4rem,15vw,8rem)] leading-[1.05] font-normal text-ink lg:text-[clamp(5rem,8vw,9rem)] [view-transition-name:logo]">
        <span className="sr-only">{NAME}</span>
        <span aria-hidden="true" className="flex flex-wrap justify-center gap-x-[0.18em]">
          {LETTERS.map((word, w) => (
            <span key={w} className="relative inline-flex whitespace-nowrap">
              {word.map(({ char, index, color, spin }) => (
                <span
                  key={index}
                  className="inline-block motion-safe:intro:animate-letter-drop"
                  style={
                    {
                      animationDelay: `${350 + index * 60}ms`,
                      '--drop-spin': `${spin}deg`,
                    } as CSSProperties
                  }
                >
                  <span
                    ref={(el) => {
                      letters.current[index] = el;
                    }}
                    data-testid="logo-letter"
                    className="relative inline-block cursor-grab touch-none px-[0.01em] [paint-order:stroke_fill] [text-shadow:0.05em_0.06em_0_var(--color-ink)] [-webkit-text-stroke:0.07em_var(--color-ink)] select-none will-change-transform motion-reduce:transition-transform motion-reduce:hover:-translate-y-[0.04em] data-grabbed:z-30 data-grabbed:cursor-grabbing data-grabbed:[text-shadow:0.1em_0.14em_0_var(--color-ink)]"
                    style={{ color }}
                  >
                    {char}
                  </span>
                </span>
              ))}
              {w === WORDS.length - 1 && (
                <>
                  <Swirl />
                  <PencilBody className={`-z-10 ${PENCIL_LAYER}`} />
                  <PencilTip className={`z-20 ${PENCIL_LAYER}`} />
                </>
              )}
            </span>
          ))}
        </span>
      </h1>
    </div>
  );
}

function Swirl() {
  return (
    <svg
      viewBox="0 0 300 50"
      preserveAspectRatio="none"
      aria-hidden="true"
      className="pointer-events-none absolute top-[88%] left-[-4%] -z-10 h-[0.32em] w-[104%] overflow-visible"
    >
      <path
        d="M4 30C40 14 70 12 92 26c14 9 4 22-8 16-12-6 0-26 26-24 30 2 50 22 80 16 20-4 22-20 10-22-12-2-14 16 4 22 22 7 56-6 84-22"
        pathLength={1}
        fill="none"
        stroke="var(--color-pop-purple)"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="[stroke-dasharray:1] motion-safe:intro:animate-swirl-draw"
      />
    </svg>
  );
}
