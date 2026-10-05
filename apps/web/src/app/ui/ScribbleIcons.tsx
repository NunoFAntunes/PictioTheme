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
