/*
 * Icons drawn like the desk's doodles: wobbly ink strokes on a 64×64 grid that overshoot their
 * corners, and a crayon fill that misses the outline a little. Decorative: the button carries the
 * name. Coloured by `currentColor` (the ink) plus an optional `fill`.
 */

const STROKE = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 4.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

type IconProps = { className?: string; fill?: string };

export function BoltIcon({ className = '', fill = 'var(--color-pop-sun)' }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={className}>
      <path d="M29 7 47 6 37 26 51 26.5 21 58 31 37 15.5 36.5Z" fill={fill} />
      <path
        {...STROKE}
        d="M26.5 5 46.5 3.5 35.5 23.5 52.5 24 19.5 61 29.5 34.5 12.5 35 26 6 31 4.5"
      />
    </svg>
  );
}

export function LockIcon({ className = '', fill = 'var(--color-pop-tomato)' }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={className}>
      <path d="M15 31.5 49 30 50.5 56 17 58Z" fill={fill} />
      <path {...STROKE} d="M21.5 29V20Q22.5 8.5 32.5 8.5 42 9 43 19.5L43.5 29.5" />
      <path
        {...STROKE}
        d="M12.5 29.5Q13 28 16 28.5L48.5 28Q51.5 28 51 31.5L49.5 55Q49 58 46 57.5L17.5 57Q14.5 57 14.5 54L13.5 31"
      />
      <path {...STROKE} d="M32 38.5Q29 40 31.5 43L30.5 49M32.5 49" strokeWidth={4} />
    </svg>
  );
}

/** A speaker with sound waves for its volume, or crossed out when muted. */
export function SpeakerIcon({
  className = '',
  fill = 'var(--color-pop-teal)',
  waves,
}: IconProps & { waves: 0 | 1 | 2 }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={className}>
      <path d="M8 27 19 26 33 13.5 34 51 19 40 9 41Z" fill={fill} />
      <path
        {...STROKE}
        d="M6.5 25.5 18.5 25 32.5 11 33.5 52.5 19 39.5 8 40Q6 33 7 26.5M19 25.5 19.5 39"
      />
      {waves === 0 && <path {...STROKE} d="M41 23 57.5 41.5M57 22.5 41.5 42" />}
      {waves >= 1 && <path {...STROKE} d="M40.5 24.5Q46.5 32 41 40.5" />}
      {waves === 2 && <path {...STROKE} d="M47 17Q58.5 31 47.5 48" />}
    </svg>
  );
}

/** A globe: a wobbly circle with its meridian and three latitudes. */
export function GlobeIcon({ className = '', fill = 'var(--color-pop-teal)' }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={className}>
      <path
        d="M32 10.5C44.5 10 54.5 19.5 54 32.5 53.5 45 44 54.5 31.5 54 19.5 53.5 10 44 10.5 31.5 11 19.5 20 11 32 10.5Z"
        fill={fill}
      />
      <path
        {...STROKE}
        d="M31 7.5C45.5 7 56.5 18 56 32.5 55.5 46 45 56.5 31 56 17.5 55.5 7.5 45 8 31 8.5 18 18.5 8 33.5 8.5"
      />
      <path {...STROKE} d="M31.5 8.5C22.5 18 22 46 32.5 55.5M32.5 8C41.5 18.5 42 45 31 55.5" />
      <path
        {...STROKE}
        strokeWidth={4}
        d="M8.5 31.5C22 33.5 42 33 55.5 30.5M13.5 19.5C25 22 41 21.5 50.5 18.5M13.5 44.5C26 42 40 42.5 51 45"
      />
    </svg>
  );
}

/** A microphone: a capsule with its grille, on a stand. */
export function MicIcon({ className = '', fill = 'var(--color-pop-pink)' }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={className}>
      <path
        d="M23.5 18Q23 8 32 7.5 41 8 41 18.5L41.5 28Q41 37.5 32 38 23.5 37.5 23 28Z"
        fill={fill}
      />
      <path
        {...STROKE}
        d="M21.5 19Q21 5.5 32 5.5 43 6 42.5 19L43 28Q42.5 40 32 40 21 39.5 21 28.5L21.5 17"
      />
      <path {...STROKE} strokeWidth={4} d="M27 16.5 37 16M27 23 37.5 22.5" />
      <path
        {...STROKE}
        d="M13.5 27Q14.5 47.5 32 47.5 49.5 47 50.5 26.5M32 47.5 31.5 56.5M21 58 43.5 56.5"
      />
    </svg>
  );
}

/** A return arrow, like on the Enter key: down from the top right, then back to the left. */
export function ReturnArrowIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={className}>
      <path
        {...STROKE}
        strokeWidth={6}
        d="M47 11.5 47.5 35Q47.5 41.5 41 41.5L15.5 42M27 30.5 15 42 27.5 53"
      />
    </svg>
  );
}

/** A crown, for the host: three wobbly points on a band. */
export function CrownIcon({ className = '', fill = 'var(--color-pop-sun)' }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={className}>
      <path d="M11.5 23 22.5 35 32 14 42 34 53 22 49 51 15.5 52Z" fill={fill} />
      <path
        {...STROKE}
        d="M9.5 19.5 21.5 33.5 32 10.5 42.5 32.5 55 18.5 50 53 14 53.5 9 22M15.5 43.5 48.5 42.5"
      />
    </svg>
  );
}

/** Two bars, for pausing the match. */
export function PauseIcon({ className = '', fill = 'var(--color-pop-sun)' }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={className}>
      <path
        d="M17.5 13 27.5 12 28.5 52 18.5 53ZM37.5 12.5 47.5 13 46.5 52.5 36.5 51.5Z"
        fill={fill}
      />
      <path
        {...STROKE}
        d="M16 10.5 28.5 10 29.5 53.5 16.5 54 15.5 12.5M36 10 48.5 10.5 48 54 35.5 53.5 35 12"
      />
    </svg>
  );
}

/** A triangle pointing on, for resuming the match. */
export function PlayIcon({ className = '', fill = 'var(--color-pop-teal)' }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={className}>
      <path d="M20 13 51 32 21 51.5Z" fill={fill} />
      <path {...STROKE} d="M17.5 9.5 53.5 31 18.5 55 16.5 11.5 20.5 10" />
    </svg>
  );
}

/** Two triangles against a bar, for skipping the turn. */
export function SkipIcon({ className = '', fill = 'var(--color-pop-pink)' }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={className}>
      <path d="M8 16 27 32 9 48.5ZM27 16 45 32.5 28 49Z" fill={fill} />
      <path
        {...STROKE}
        d="M6 12.5 28.5 32 7 52.5 5.5 14.5M25 12.5 46.5 32 26 52 24.5 15M54.5 10.5 53.5 54"
      />
    </svg>
  );
}

/** A chequered finish flag, for ending the match. */
export function FinishFlagIcon({ className = '', fill = 'var(--color-paper)' }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={className}>
      <path
        d="M17 12Q26 8 34 12.5 42.5 17 50.5 13L50 35Q41.5 38.5 33.5 34.5 25 30 17.5 34Z"
        fill={fill}
      />
      <path
        d="M17 12.5Q21.5 10.5 25.5 10.5L25.5 22Q21 22 17 23.5ZM25.5 22Q30 21.5 34 23.5L33.5 34.5Q29.5 32 25.5 31.5ZM34 12.5Q38 15 42 15.5L42 26Q38 25.5 34 23.5ZM42 26Q46.5 26.5 50.5 24L50 35Q46 36.5 42 36.5Z"
        fill="currentColor"
        opacity="0.85"
      />
      <path
        {...STROKE}
        d="M14.5 58.5 15.5 6.5M15.5 10.5Q25 5.5 34 10.5 43 15.5 52.5 10.5L51.5 37Q42 41 33.5 36.5 24.5 32 15 36"
      />
    </svg>
  );
}
