import type { CSSProperties } from 'react';
import type { Game } from '../../site';

/**
 * Doodle Tower's half: its home page in miniature (apps/tower-web's HomePage). Sky over grass,
 * a few clouds, a bird now and then, the logo whose O's are balloons and whose T is the stone
 * plinth every tower stands on, and a wobbly tower of doodles on the grass that stacks itself as
 * the page opens. A still copy of the game's TowerLogo: here the balloons only bob.
 */

const OUTLINE = 'var(--color-dusk-950)';
/** The letters' outline (0.09em) and drop (0.08em), in the shapes' 100-units-per-em. */
const STROKE = 9;
const DROP = 8;

const BALLOONS = {
  red: 'oklch(0.68 0.22 25)',
  yellow: 'oklch(0.85 0.17 92)',
  blue: 'oklch(0.7 0.16 230)',
};

function Balloon({ color, delay }: { color: string; delay: number }) {
  return (
    <span className="relative mx-[0.01em] inline-block h-[0.72em] w-[0.64em]">
      <span
        className="absolute inset-0 motion-safe:animate-balloon-bob"
        style={{ animationDelay: `${delay}s` }}
      >
        <svg viewBox="0 0 64 72" className="absolute inset-0 h-full w-full overflow-visible">
          <path
            d="M32 76c-6 8 6 14 0 22s5 12 2 18"
            fill="none"
            stroke={OUTLINE}
            strokeWidth={3}
            strokeLinecap="round"
          />
          <g
            transform={`translate(0 ${DROP})`}
            fill={OUTLINE}
            stroke={OUTLINE}
            strokeWidth={STROKE}
          >
            <ellipse cx={32} cy={36} rx={30} ry={35} />
            <path d="M32 70 26 79h12Z" strokeLinejoin="round" />
          </g>
          <g fill={color} stroke={OUTLINE} strokeWidth={STROKE} paintOrder="stroke">
            <path d="M32 70 26 79h12Z" strokeLinejoin="round" />
            <ellipse cx={32} cy={36} rx={30} ry={35} />
          </g>
          <ellipse
            cx={20}
            cy={20}
            rx={6}
            ry={11}
            fill="white"
            opacity={0.6}
            transform="rotate(30 20 20)"
          />
        </svg>
      </span>
    </span>
  );
}

function PlinthT() {
  return (
    <span className="relative mr-[0.02em] inline-block h-[0.72em] w-[0.64em]">
      <svg viewBox="0 0 64 72" className="absolute inset-0 h-full w-full overflow-visible">
        <g transform={`translate(0 ${DROP})`} fill={OUTLINE} stroke={OUTLINE} strokeWidth={STROKE}>
          <rect x={16} y={16} width={32} height={56} rx={3} />
          <rect x={0} y={0} width={64} height={24} rx={6} />
        </g>
        <g stroke={OUTLINE} strokeWidth={STROKE} paintOrder="stroke" strokeLinejoin="round">
          <rect x={16} y={16} width={32} height={56} rx={3} fill="oklch(0.86 0.025 85)" />
          <rect x={0} y={0} width={64} height={24} rx={6} fill="oklch(0.86 0.025 85)" />
        </g>
        <g stroke="oklch(0.62 0.04 70)" strokeWidth={2.5} strokeLinecap="round">
          <path d="M18 38h28M18 56h28M32 24v14M25 38v18M39 56v14" />
          <path d="M22 12v10M44 12v10" />
        </g>
        <path
          d="M2 4Q2 0 6 0h52q4 0 4 4v8q-3 4-6 0-3 5-7 0-3 4-7 0-3 5-7 0-3 4-7 0-3 5-7 0-3 4-7 0-3 5-6 0Z"
          fill="var(--color-grass)"
        />
        <path d="M6 2h50" stroke="oklch(0.85 0.17 132)" strokeWidth={3} strokeLinecap="round" />
        <rect
          x={0}
          y={0}
          width={64}
          height={24}
          rx={6}
          fill="none"
          stroke={OUTLINE}
          strokeWidth={STROKE / 2}
        />
      </svg>
    </span>
  );
}

/** The tower's pieces, bottom to top, and how much each spins as it drops on. */
const PIECES = [
  { d: 'M22 168 98 166 94 140 26 142Z', fill: 'oklch(0.72 0.19 42)', spin: '-10deg' },
  { d: 'M40 140c-4-22 44-26 42 0Z', fill: 'oklch(0.85 0.17 92)', spin: '14deg' },
  { d: 'M34 120 88 116 84 98 30 102Z', fill: 'oklch(0.7 0.16 230)', spin: '-8deg' },
  { d: 'M48 98 62 62 78 97Z', fill: 'oklch(0.68 0.22 25)', spin: '20deg' },
  { d: 'M52 52a11 11 0 1 0 22 0a11 11 0 1 0-22 0', fill: 'oklch(0.76 0.19 140)', spin: '-30deg' },
];

/** A bird crossing the sky now and then, flapping (global.css). */
function Bird() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 40 20"
      className="bird absolute top-0 left-0 w-[min(5cqi,2.5rem)] overflow-visible"
    >
      <path
        className="bird-wings"
        d="M2 6q9-6 18 6 9-12 18-6"
        fill="none"
        stroke={OUTLINE}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** A tower of doodled pieces on its plinth, leaning the way they always do. */
function DoodleStack() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 120 200"
      className="pane-stack absolute bottom-[14%] left-[12%] w-[min(18cqi,9rem)]"
    >
      <g stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round" strokeLinecap="round">
        <rect x={36} y={168} width={48} height={30} rx={4} fill="oklch(0.86 0.025 85)" />
        {PIECES.map(({ d, fill, spin }, i) => (
          <path
            key={d}
            d={d}
            fill={fill}
            className="stack-piece"
            style={{ '--i': i, '--spin': spin } as CSSProperties}
          />
        ))}
      </g>
    </svg>
  );
}

function Cloud({ className }: { className: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 120 60" className={`absolute ${className}`}>
      <path
        d="M20 52a16 16 0 0 1 4-31 22 22 0 0 1 40-8 18 18 0 0 1 32 10 15 15 0 0 1 4 29Z"
        fill="var(--color-cloud)"
        opacity={0.95}
      />
    </svg>
  );
}

export function TowerPreview({ game }: { game: Game }) {
  return (
    <div className="absolute inset-0 bg-[linear-gradient(var(--color-sky),var(--color-sky-light)_82%,var(--color-grass)_82%)]">
      <div className="pane-content">
        <Cloud className="pane-cloud top-[12%] right-[14%] w-[min(22cqi,10rem)]" />
        <Cloud className="pane-cloud top-[30%] left-[16%] w-[min(14cqi,6rem)] [animation-delay:-6s]" />
        <Cloud className="pane-cloud bottom-[30%] right-[8%] w-[min(16cqi,7rem)] [animation-delay:-11s]" />
        <Bird />
        <DoodleStack />

        <div className="pane-art relative flex flex-col items-center text-center">
          <h2
            aria-label={game.name}
            className="tower-title flex flex-col items-center font-tower-display text-[clamp(2.5rem,min(15cqi,13cqh),7rem)] leading-[0.95] tracking-wide whitespace-nowrap"
          >
            <span aria-hidden="true">
              D
              <Balloon color={BALLOONS.red} delay={0} />
              <Balloon color={BALLOONS.yellow} delay={-1.3} />
              dle
            </span>
            <span aria-hidden="true" className="text-sun">
              <PlinthT />
              <Balloon color={BALLOONS.blue} delay={-2.1} />
              wer
            </span>
          </h2>
          <p className="mt-[min(2rem,3cqh)] max-w-[22rem] rounded-2xl bg-dusk-950/70 px-5 py-3 text-lg leading-snug font-semibold text-cloud">
            {game.tagline}
            <span className="mt-1 block text-sm font-bold text-cloud/70">{game.players}</span>
          </p>
          <span className="pane-play mt-[min(1.5rem,3cqh)] inline-block rounded-full border-4 border-dusk-950 bg-sun px-7 py-2 font-tower-display text-2xl tracking-wide text-dusk-950 shadow-[0_5px_0_var(--color-dusk-950)]">
            Play →
          </span>
        </div>
      </div>
    </div>
  );
}
