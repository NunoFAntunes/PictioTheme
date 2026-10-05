import { playerHash } from '../name-font';
import { useCountUp } from '../use-count-up';

/**
 * A player's points on a scribbled sticker beside their character, with their rank in the corner.
 * The score counts up when it changes; `gained` floats up as "+N" at the end of a turn.
 */

/** Wobbly hand-cut blobs (viewBox 0 0 100 100). */
const BLOBS = [
  'M50 6C72 4 95 20 94 48s-18 46-44 46S5 78 6 50 26 8 50 6Z',
  'M47 5c25-2 48 14 47 40 0 27-15 49-45 50C21 96 4 76 6 49 8 22 24 7 47 5Z',
  'M53 7c22 3 41 19 40 45-1 25-21 43-45 42C24 93 6 75 7 48 8 24 29 4 53 7Z',
  'M50 4c27 1 44 22 44 46 0 27-20 45-45 44C22 93 5 73 6 47 7 21 25 3 50 4Z',
] as const;

const COLOURS = [
  'fill-pop-sun',
  'fill-pop-teal',
  'fill-pop-pink',
  'fill-pop-tomato',
  'fill-pop-purple',
] as const;

const SIZES = {
  lg: { box: 'size-11', number: 'text-sm' },
  md: { box: 'size-9', number: 'text-xs' },
  sm: { box: 'size-8', number: 'text-[0.65rem]' },
} as const;

export type StickerSize = keyof typeof SIZES;

type Props = {
  score: number;
  rank: number;
  /** Picks the blob shape, colour and tilt. */
  seed: number;
  size: StickerSize;
  /** Points won this turn (the reveal's delta), shown floating up while > 0. */
  gained: number;
  /** Changes every turn, so the "+N" plays again. */
  turnKey: string;
};

export function ScoreSticker({ score, rank, seed, size, gained, turnKey }: Props) {
  const shown = useCountUp(score);
  // Separate hashes, so shape, colour and tilt don't move in lockstep between players.
  const pick = (what: string) => playerHash(String(seed), what);
  const tilt = (pick('tilt') % 17) - 8;
  return (
    <div className={`relative ${SIZES[size].box}`} style={{ rotate: `${tilt}deg` }}>
      <svg
        viewBox="0 0 100 100"
        className="absolute inset-0 size-full overflow-visible"
        aria-hidden="true"
      >
        <path
          d={BLOBS[pick('blob') % BLOBS.length]}
          className={`${COLOURS[pick('colour') % COLOURS.length]} stroke-ink`}
          strokeWidth={5}
          strokeLinejoin="round"
        />
      </svg>
      <span
        className={`absolute inset-0 flex items-center justify-center font-logo leading-none text-ink tabular-nums ${SIZES[size].number}`}
        aria-label={`${score} points`}
      >
        {shown}
      </span>
      <span
        className="absolute -top-2 -right-2 rounded-full bg-ink px-1 font-logo text-[0.6rem] leading-tight text-paper"
        aria-label={`Rank ${rank}`}
      >
        #{rank}
      </span>
      {gained > 0 && (
        <span
          key={turnKey}
          className="pointer-events-none absolute -inset-x-6 -top-5 text-center font-logo text-sm whitespace-nowrap text-solved [text-shadow:0_1px_0_white] motion-safe:animate-points-float motion-reduce:hidden"
          aria-hidden="true"
        >
          +{gained}
        </span>
      )}
    </div>
  );
}
