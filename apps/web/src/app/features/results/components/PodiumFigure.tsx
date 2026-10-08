import type { PublicPlayer } from '@pictiotheme/protocol';
import type { CSSProperties } from 'react';
import { avatarUrl } from '../../avatar';

/**
 * A player on the podium (or in the crowd under it): their doodle, in layers that each move one
 * way, so nothing fights over a transform. The button takes the entrance and pokes, `act` the
 * acting (sway, lean, keel over, victory hop), `spin` the victory turn, which shows the back of
 * the paper: the same doodle, mirrored and faint.
 */

export type FigureMotion = {
  /** Not on stage yet: keeps its place but isn't drawn. */
  hidden: boolean;
  enter?: string;
  act?: string;
  spin?: string;
  /** The line boil's speed (ms per cycle), or null when still. */
  boilMs: number | null;
  /** Desynchronises sway and boil between players (ms, negative). */
  offsetMs: number;
  lean?: string;
  dir?: 1 | -1;
};

type Props = {
  player: PublicPlayer;
  /** CSS width and height. */
  size: string;
  motion: FigureMotion;
  crown?: { hidden: boolean; animation?: string };
  awards: { label: string; hidden: boolean; animation?: string }[];
  /** Which way the award stickers stick out: away from the winner beside them. */
  awardSide: 'left' | 'right';
  register: (el: HTMLButtonElement | null) => void;
  onPoke: () => void;
};

export function PodiumFigure({
  player,
  size,
  motion,
  crown,
  awards,
  awardSide,
  register,
  onPoke,
}: Props) {
  const boil =
    motion.boilMs === null
      ? undefined
      : `boil ${motion.boilMs}ms step-end ${motion.offsetMs % motion.boilMs}ms infinite`;
  const doodle = (
    <img
      src={avatarUrl(player.avatar)}
      alt=""
      draggable={false}
      className="size-full object-contain"
      style={{ animation: boil }}
    />
  );
  return (
    <button
      ref={register}
      type="button"
      onClick={onPoke}
      aria-label={`Poke ${player.name}`}
      className="relative block shrink-0 origin-bottom rounded-xl focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-pop-purple focus-visible:outline-dashed"
      style={{
        width: size,
        height: size,
        visibility: motion.hidden ? 'hidden' : undefined,
        animation: motion.enter,
      }}
    >
      <span
        className="absolute inset-0 origin-bottom perspective-[600px]"
        style={
          {
            animation: motion.act,
            '--lean': motion.lean,
            '--dir': motion.dir,
          } as CSSProperties
        }
      >
        <span
          data-spin
          className="absolute inset-0 transform-3d"
          style={{ animation: motion.spin }}
        >
          <span className="absolute inset-0 backface-hidden">{doodle}</span>
          <span className="absolute inset-0 rotate-y-180 opacity-30 grayscale backface-hidden">
            <span className="block size-full -scale-x-100">{doodle}</span>
          </span>
        </span>
        {crown && (
          <svg
            viewBox="0 0 60 40"
            aria-hidden="true"
            className="absolute top-[2%] left-1/2 z-10 w-[46%] overflow-visible fill-pop-sun stroke-ink stroke-3 [stroke-linejoin:round]"
            style={{
              translate: '-50% -62%',
              rotate: '-10deg',
              visibility: crown.hidden ? 'hidden' : undefined,
              animation: crown.animation,
            }}
          >
            <path d="M6 34 L4 10 L18 22 L30 4 L42 22 L56 10 L54 34Z" />
            <circle cx="30" cy="25" r="4.5" className="fill-pop-tomato" />
          </svg>
        )}
        {awards.map((award, i) => (
          <span
            key={award.label}
            className={`absolute ${awardSide === 'left' ? 'right-[58%]' : 'left-[58%]'} z-20 rounded-[0.8em_0.25em_0.8em_0.3em] border-2 border-ink bg-paper px-2 font-hand text-base leading-snug whitespace-nowrap text-ink shadow-[1px_2px_0_var(--color-ink)]`}
            style={{
              top: `${6 + i * 30}%`,
              rotate: i % 2 ? '6deg' : '-8deg',
              visibility: award.hidden ? 'hidden' : undefined,
              animation: award.animation,
            }}
          >
            {award.label}
          </span>
        ))}
      </span>
    </button>
  );
}
