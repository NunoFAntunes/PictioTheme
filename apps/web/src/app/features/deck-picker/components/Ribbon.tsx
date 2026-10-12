import { useId, useRef, useState, type PointerEvent } from 'react';

/**
 * The notebook's ribbon bookmark (LibraryPages): a strip of fabric coming out from under the bottom
 * edge of the second page (folded, from the top of it), its swallowtail end drawn in ink, with a double arrow
 * pointing to the page it turns to. Press it, or pull it down and let go, to turn the page. Pulling
 * stretches it and lifts the page's corner, more the further it goes; let go short of the mark
 * and it springs back. A new ribbon comes with each side, flipping over (around its length) and
 * swinging as it lands; the first one sways once, to be noticed.
 */

/** How far (after the give) a pull has to go to turn the page. */
const PULL_TO_TURN = 32;
/** The most a pull stretches it: it gives less the further it goes. */
const MAX_PULL = 90;

export function Ribbon({
  direction,
  label,
  colour,
  turned,
  onTurn,
}: {
  /** Which way the arrow points: forward to the next page, or back. */
  direction: 'next' | 'back';
  label: string;
  /** The fabric's colour, as a background and as an SVG fill (`bg-…` and `fill-…`). */
  colour: { bg: string; fill: string };
  /** Whether the page has turned yet (it flips in), or this is the first ribbon (it sways). */
  turned: boolean;
  onTurn: () => void;
}) {
  const sheen = `sheen${useId().replace(/[^\w-]/g, '')}`;
  const [pull, setPull] = useState(0);
  const [dragging, setDragging] = useState(false);
  /**
   * The pull as it goes, kept off the render: moves come faster than renders, and letting go
   * must see the last one.
   */
  const drag = useRef<{ startY: number; pull: number; moved: boolean } | null>(null);
  /** A drag ends in a click too; it has already done what it does. */
  const skipClick = useRef(false);

  function onPointerDown(e: PointerEvent<HTMLButtonElement>) {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { startY: e.clientY, pull: 0, moved: false };
    setDragging(true);
  }
  function onPointerMove(e: PointerEvent<HTMLButtonElement>) {
    if (!drag.current) return;
    const dy = e.clientY - drag.current.startY;
    if (Math.abs(dy) > 4) drag.current.moved = true;
    drag.current.pull = dy > 0 ? MAX_PULL * (1 - Math.exp(-dy / MAX_PULL)) : 0;
    setPull(drag.current.pull);
  }
  function onPointerUp() {
    if (!drag.current) return;
    const { moved, pull: last } = drag.current;
    drag.current = null;
    setDragging(false);
    setPull(0);
    skipClick.current = moved;
    if (moved && last >= PULL_TO_TURN) onTurn();
  }

  const ready = pull >= PULL_TO_TURN;

  return (
    <>
      <div className="peer relative z-30 mr-8 h-14 w-6 shrink-0 self-end [--ribbon:1.25rem] @[40rem]:absolute @[40rem]:top-[calc(100%+2px)] @[40rem]:right-14 @[40rem]:mr-0 @[40rem]:h-0 @[40rem]:[--ribbon:0.25rem]">
        <button
          type="button"
          aria-label={label}
          title={label}
          onClick={() => {
            if (skipClick.current) skipClick.current = false;
            else onTurn();
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{ height: `calc(var(--ribbon) + var(--give) + ${pull}px)` }}
          className={`group absolute inset-x-0 top-0 flex origin-top cursor-grab touch-none flex-col drop-shadow-[2px_2px_0_rgb(0_0_0/0.18)] [--give:0px] hover:[--give:0.4rem] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink focus-visible:outline-dashed active:cursor-grabbing ${
            dragging
              ? ''
              : 'transition-[height] duration-500 ease-[cubic-bezier(0.34,1.6,0.64,1)] motion-reduce:transition-none'
          } ${turned ? 'motion-safe:animate-ribbon-flip' : 'motion-safe:animate-ribbon-sway'}`}
        >
          {/* The fabric, with a sheen down it, in the book's shadow where it comes out. */}
          <span
            className={`relative flex-1 border-x-2 border-ink bg-[linear-gradient(to_right,rgb(0_0_0/0.14),transparent_30%,rgb(255_255_255/0.35)_55%,transparent_75%,rgb(0_0_0/0.14))] ${colour.bg}`}
          >
            <span className="absolute inset-x-0 top-0 h-1.5 bg-linear-to-b from-ink/35 to-transparent" />
          </span>
          {/* The swallowtail end, with the arrow on it. */}
          <svg
            aria-hidden="true"
            viewBox="0 0 28 34"
            className={`-mt-px block w-full overflow-visible ${colour.fill}`}
          >
            <path d="M1 0V33L14 24L27 33V0Z" />
            <path
              d="M1 0V33L14 24L27 33V0"
              fill="none"
              stroke="var(--color-ink)"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <path d="M1 0V33L14 24L27 33V0Z" fill={`url(#${sheen})`} />
            <defs>
              <linearGradient id={sheen} x1="0" x2="1" y1="0" y2="0">
                <stop offset="0" stopColor="black" stopOpacity="0.14" />
                <stop offset="0.3" stopColor="black" stopOpacity="0" />
                <stop offset="0.55" stopColor="white" stopOpacity="0.35" />
                <stop offset="0.75" stopColor="white" stopOpacity="0" />
                <stop offset="1" stopColor="black" stopOpacity="0.14" />
              </linearGradient>
            </defs>
            <path
              d={
                direction === 'next'
                  ? 'M8 5L13 10L8 15M14 5L19 10L14 15'
                  : 'M20 5L15 10L20 15M14 5L9 10L14 15'
              }
              fill="none"
              stroke="var(--color-ink)"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ transformBox: 'fill-box' }}
              className={`origin-center transition-transform duration-200 ${ready ? 'scale-125' : ''} ${
                direction === 'next'
                  ? 'group-hover:translate-x-0.5'
                  : 'group-hover:-translate-x-0.5'
              }`}
            />
          </svg>
        </button>
      </div>
      {direction === 'next' && (
        // The page's corner, lifting as the ribbon is pulled (or pointed at): the page wants to turn.
        <span
          aria-hidden="true"
          style={{ ['--lift' as string]: `${pull * 0.75}px` }}
          className={`pointer-events-none absolute right-0 bottom-0 z-20 hidden size-[calc(var(--peek)+var(--lift))] rounded-tl-md bg-[linear-gradient(to_top_left,color-mix(in_oklch,var(--color-paper)_82%,var(--color-ink))_50%,transparent_50%),linear-gradient(to_top_left,transparent_50%,var(--color-paper)_50%,color-mix(in_oklch,var(--color-paper)_90%,var(--color-ink))_100%)] drop-shadow-[-2px_-2px_2px_rgb(0_0_0/0.2)] [--peek:0px] peer-hover:[--peek:1.25rem] @[40rem]:block ${
            dragging
              ? ''
              : 'transition-[width,height] duration-500 ease-[cubic-bezier(0.34,1.6,0.64,1)] motion-reduce:transition-none'
          }`}
        />
      )}
    </>
  );
}
