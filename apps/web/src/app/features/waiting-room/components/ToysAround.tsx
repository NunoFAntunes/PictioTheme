import type { ReactNode } from 'react';
import {
  CoffeeStain,
  Crayon,
  Eraser,
  FortuneTeller,
  Mug,
  PaperBallGame,
  RubberStamp,
  SpinningPencil,
} from '../../desk-toys';

/*
 * What players who aren't the host get while they wait (screens.md §3): the house rules in the
 * middle, the same 23rem notepad the host has, with things left lying on the sheet either side of
 * it to play with, like the home page's desk. The mug sloshes, the eraser crumbles, the crayons
 * scribble, the fortune teller tells fortunes, the stamp stamps, the pencil spins, and the paper
 * ball goes in the bin (if you throw it from afar). Nobody else sees what you do with them.
 *
 * Narrower than 46rem (the waiting room's container) the rules go on top and the two sides of toys
 * sit under them. The toys scale with the width of a side (their font size, about 16em across).
 *
 * Without children (the results, under the podium) the two sides lie next to each other at any
 * width. It needs an `@container` around it, like the waiting room's.
 */

/** About a sixteenth of a side's width: (room − rules − gaps) / 2 / 16, at most 1.2rem. */
const TOY_SCALE = 'text-[min(1.2rem,calc((100cqw-1rem)/32))]';
const TOY_SCALE_BESIDE = `${TOY_SCALE} @[46rem]:text-[min(1.2rem,calc((100cqw-25rem)/32))]`;

export function ToysAround({ children }: { children?: ReactNode }) {
  // Beside the rules from 46rem; otherwise (or with no rules) the two sides share a row.
  const beside = children !== undefined;
  const scale = beside ? TOY_SCALE_BESIDE : TOY_SCALE;
  const at = (narrow: string, wide: string) => (beside ? `${narrow} ${wide}` : narrow);
  return (
    <div
      data-testid="toys-around"
      className={`grid grid-cols-2 gap-x-4 gap-y-3 pb-5 ${at('', '@[46rem]:grid-cols-[minmax(0,1fr)_23rem_minmax(0,1fr)]')}`}
    >
      {beside && (
        <div className="col-span-2 @[46rem]:col-span-1 @[46rem]:col-start-2 @[46rem]:row-start-1">
          {children}
        </div>
      )}

      <Side
        scale={scale}
        className={at('col-start-1 row-start-2', '@[46rem]:row-start-1')}
        beside={beside}
      >
        <p className="absolute top-3 left-1 flex -rotate-3 items-end gap-1 font-hand text-base whitespace-nowrap text-ink/55">
          Bored? Poke things.
          <svg
            viewBox="0 0 40 30"
            className="-mb-2 w-8 overflow-visible"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M2 6 C16 2 30 8 32 24" />
            <path d="M25 19 L32 25 L37 17" />
          </svg>
        </p>
        <Eraser place={{ className: 'left-[54%] top-[19%]', unit: 0.05, rotate: -10 }} />
        {/* Low down, clear of the fortunes that pop up above the teller. */}
        <Crayon
          place={{ className: 'left-[10%] top-[77%]', unit: 0.048, rotate: -100 }}
          color="#ff8fab"
          shade="#e5698b"
          side={1}
        />
        <FortuneTeller place={{ className: 'left-[46%] top-[58%]', unit: 0.052, rotate: 12 }} />
        <CoffeeStain className="top-[76%] left-[4%] w-[4.5em] rotate-[200deg]" />
        <Mug
          place={{ className: 'left-[68%] top-[87%]', unit: 0.045, rotate: 150 }}
          steam="#b9a58c"
        />
      </Side>

      <Side
        scale={scale}
        className={at('col-start-2 row-start-2', '@[46rem]:col-start-3 @[46rem]:row-start-1')}
        beside={beside}
      >
        <RubberStamp place={{ className: 'left-[50%] top-[16%]', unit: 0.055, rotate: 8 }} />
        <Crayon
          place={{ className: 'left-[88%] top-[39%]', unit: 0.048, rotate: 4 }}
          color="#4cc9c0"
          shade="#2fa79e"
          side={1}
        />
        <SpinningPencil place={{ className: 'left-[50%] top-[60%]', unit: 0.024, rotate: 0 }} />
      </Side>

      {/* The ball rolls about the right-hand side (both sides when they're under the rules). */}
      <div
        aria-hidden="true"
        className={`pointer-events-none relative col-span-2 col-start-1 row-start-2 select-none ${at('', '@[46rem]:col-span-1 @[46rem]:col-start-3 @[46rem]:row-start-1')} ${scale}`}
      >
        <PaperBallGame
          ballClassName={at('left-[58%] top-[88%]', '@[46rem]:left-[16%]')}
          basketClassName={at('left-[86%] top-[87%]', '@[46rem]:left-[70%]')}
        />
      </div>
    </div>
  );
}

/** One side of toys beside (or under) the rules. */
function Side({
  className,
  scale,
  beside,
  children,
}: {
  className: string;
  scale: string;
  beside: boolean;
  children: ReactNode;
}) {
  return (
    <div
      aria-hidden="true"
      className={`relative h-[26rem] select-none ${beside ? '@[46rem]:h-auto @[46rem]:min-h-[28rem]' : ''} ${className}`}
    >
      <div className={`absolute inset-0 overflow-clip ${scale}`}>{children}</div>
    </div>
  );
}
