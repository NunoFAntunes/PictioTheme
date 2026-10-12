import { useId, type ComponentProps, type ReactNode } from 'react';

/*
 * A spiral-bound notepad lying on the sheet (the house rules): ruled paper outlined in ink like the
 * other panels, a wire coil along the top threaded through punched holes, and the edges of the
 * pages under it peeking out at the bottom right. Always light: it sits on the room's paper.
 *
 * NotebookSpread is the same notebook lying open (the deck picker): two pages with the coil down
 * the gutter between them. Where there's no room for two pages it folds back into a notepad, the
 * first page on top of the second.
 */

/**
 * Ruled lines, a little under the coil, faint enough to write over. Add `bg-local` on something
 * that scrolls, so the lines scroll with what's written on them.
 */
export const RULED =
  'bg-paper bg-[repeating-linear-gradient(to_bottom,transparent_0_1.75rem,color-mix(in_oklch,var(--color-paper-line)_70%,transparent)_1.75rem_calc(1.75rem+1px))] bg-[position:0_0.6rem]';

/** Two pages under the top one, each a paper edge outlined in ink. */
const PAGES =
  'shadow-[3px_3px_0_-2px_var(--color-paper),3px_3px_0_0_var(--color-ink),6px_6px_0_-2px_var(--color-paper),6px_6px_0_0_var(--color-ink)]';

/** The coil's wire: grey metal with a glint. */
const WIRE = 'oklch(0.55 0.015 270)';

export function Notebook({
  className = '',
  children,
  ...section
}: { className?: string; children: ReactNode } & ComponentProps<'section'>) {
  return (
    <section
      {...section}
      className={`relative mt-3 rounded-lg border-2 border-ink px-4 pt-7 pb-4 text-ink ${RULED} ${PAGES} ${className}`}
    >
      <Spiral />
      {children}
    </section>
  );
}

/**
 * Open at two pages of the same width, side by side from 40rem wide, the coil in the middle and a
 * page number in each bottom corner. Give the spread a height with `className`: side by side, each
 * page scrolls on its own (let `second` grow and scroll, `@[40rem]:overflow-y-auto`, and mirror the
 * first page's padding: `px-4 @[40rem]:pl-8`); folded, the notebook scrolls as one, the first page
 * going by on the way to the second.
 */
export function NotebookSpread({
  first,
  second,
  className = '',
  ...section
}: { first: ReactNode; second: ReactNode; className?: string } & Omit<
  ComponentProps<'section'>,
  'children'
>) {
  return (
    <section
      {...section}
      className={`@container relative mt-3 flex min-h-0 flex-col rounded-lg border-2 border-ink bg-paper text-ink ${PAGES} ${className}`}
    >
      <Spiral className="@[40rem]:hidden" />
      <div className="grid min-h-0 flex-1 content-start overflow-y-auto overscroll-contain rounded-lg @[40rem]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] @[40rem]:grid-rows-[minmax(0,1fr)] @[40rem]:overflow-visible">
        <div
          className={`relative flex flex-col gap-3 rounded-t-lg bg-local px-4 pt-7 pb-3 @[40rem]:min-h-0 @[40rem]:overflow-y-auto @[40rem]:overscroll-contain @[40rem]:rounded-l-lg @[40rem]:rounded-tr-none @[40rem]:pt-5 @[40rem]:pr-8 @[40rem]:pb-6 ${RULED}`}
        >
          {first}
        </div>
        <div className="relative flex flex-col border-t-2 @[40rem]:min-h-0 border-dashed border-ink/15 @[40rem]:border-t-0">
          {second}
          {/* The gutter: each page curving down into the binding. */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 -left-8 hidden w-16 bg-[linear-gradient(to_right,transparent,rgb(0_0_0/0.07)_45%,rgb(0_0_0/0.12)_50%,rgb(0_0_0/0.07)_55%,transparent)] @[40rem]:block"
          />
          <Coil />
        </div>
      </div>
      <PageNumber side="left">1</PageNumber>
      <PageNumber side="right">2</PageNumber>
    </section>
  );
}

/** A page number, pencilled in a bottom corner of the open spread. */
function PageNumber({ side, children }: { side: 'left' | 'right'; children: string }) {
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute bottom-0.5 hidden rounded-full bg-paper/90 px-1.5 font-hand text-sm text-ink/40 @[40rem]:block ${side === 'left' ? 'left-3' : 'right-3'}`}
    >
      {children}
    </span>
  );
}

/** A unique id that's safe in `url(#…)` (React's ids have colons or guillemets). */
function usePatternId(): string {
  return `coil${useId().replace(/[^\w-]/g, '')}`;
}

/** The coil: one ring per hole, repeated across the top edge (the paper's edge is at y = 14). */
function Spiral({ className = '' }: { className?: string }) {
  // Its own pattern id: a folded spread hides its coil, and a pattern in a hidden SVG draws nothing.
  const id = usePatternId();
  return (
    <svg
      aria-hidden="true"
      className={`pointer-events-none absolute inset-x-3 -top-4 h-8 w-[calc(100%-1.5rem)] ${className}`}
    >
      <defs>
        <pattern id={id} width="20" height="32" patternUnits="userSpaceOnUse" x="4">
          <ellipse cx="10" cy="24" rx="3.2" ry="2.8" fill="var(--color-ink)" opacity="0.85" />
          <path
            d="M8 24.5C5 16 5.5 5 11 3.5 15.5 2.5 15.5 12 12.5 23"
            fill="none"
            stroke={WIRE}
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d="M8.2 18C7 11 8.5 6 11 5.5"
            fill="none"
            stroke="white"
            strokeWidth="1"
            strokeLinecap="round"
            opacity="0.8"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

/**
 * The coil down an open spread's gutter (x = 16): each ring comes out of a hole in the first page
 * and goes into one in the second.
 */
function Coil() {
  const id = usePatternId();
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-3 left-0 hidden h-[calc(100%-1.5rem)] w-8 -translate-x-1/2 @[40rem]:block"
    >
      <defs>
        <pattern id={id} width="32" height="22" patternUnits="userSpaceOnUse" y="6">
          <ellipse cx="5.5" cy="11" rx="2.6" ry="3" fill="var(--color-ink)" opacity="0.85" />
          <ellipse cx="26.5" cy="11" rx="2.6" ry="3" fill="var(--color-ink)" opacity="0.85" />
          <path
            d="M6 12C5.5 5.5 10 3 16 3S26.5 5.5 26 12"
            fill="none"
            stroke={WIRE}
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d="M9 7C11 5 13.5 4.3 17 4.3"
            fill="none"
            stroke="white"
            strokeWidth="1"
            strokeLinecap="round"
            opacity="0.8"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}
