/*
 * The drawing toolbar's icons, drawn like ui/ScribbleIcons: wobbly ink strokes on a 64×64 grid
 * with a crayon fill. `ink` is the current colour where a tool carries paint (the pencil's lead,
 * the bucket's spill, the dropper's tube). Decorative: the button carries the name.
 */

const STROKE = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 4.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

type IconProps = { className?: string };
type InkIconProps = IconProps & { ink?: string };

export function PencilIcon({ className = '', ink = 'currentColor' }: InkIconProps) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={className}>
      <path d="M13 41.5 46.5 8.5 57.5 19.5 24.5 52.5Z" fill="var(--color-pop-sun)" />
      <path d="M40.5 14 46.5 8.5 57.5 19.5 52 25.5Z" fill="var(--color-pop-pink)" />
      <path d="M13 41.5 24.5 52.5 9 57Z" fill="var(--color-paper)" />
      <path d="M8.5 57.5 10.5 50.5 15.5 55.5Z" fill={ink} />
      <path
        {...STROKE}
        d="M11.5 43 45.5 9.5Q46.5 8 48 9L57 18Q58.5 19.5 57 21L23.5 54 8.5 57.5 12 42"
      />
      <path {...STROKE} d="M40 13.5 52.5 26" />
      <path {...STROKE} d="M13.5 41.5Q19 46 24 53" />
    </svg>
  );
}

export function BucketIcon({ className = '', ink = 'currentColor' }: InkIconProps) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={className}>
      <path d="M12 23 44 18.5 40.5 52 18.5 54Z" fill="var(--color-pop-teal)" />
      <path d="M43 19Q52 19.5 54 29.5 55.5 40 52.5 44 49 46.5 48.8 40 49 32 44 27.5Z" fill={ink} />
      <path {...STROKE} d="M10.5 22 45 17 41 52.5Q40.5 55 38 55L20 56Q17.5 56 17.5 53.5L11.5 24" />
      <path {...STROKE} d="M11 22.5Q28 30 45 17.5" />
      <path {...STROKE} d="M15.5 23Q22 3.5 41.5 18" />
      <path
        {...STROKE}
        strokeWidth={3.5}
        d="M45 18.5Q53 20 54.5 30.5 55.5 41 52.5 44.5 48.5 47 49 39.5 49.5 31.5 44 27.5"
      />
    </svg>
  );
}

export function EraserIcon({ className = '' }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={className}>
      <path d="M8 38.5 25.5 25 38.5 43 21 56Z" fill="var(--color-pop-pink)" />
      <path d="M25.5 25 43 12 56 29.5 38.5 43Z" fill="var(--color-pop-purple)" />
      <path {...STROKE} d="M7 38 43.5 11 57 29.5 21 57 7.5 39.5" />
      <path {...STROKE} d="M25 24.5 39 43.5" />
      <path {...STROKE} strokeWidth={5.5} d="M5.5 50h.1M12 58h.1M3.5 44h.1" />
    </svg>
  );
}

export function UndoIcon({ className = '' }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={className}>
      <path {...STROKE} strokeWidth={6.5} d="M15 25.5H38Q53.5 25 53 39.5 52.5 53.5 37.5 53H27" />
      <path {...STROKE} strokeWidth={6.5} d="M26 13 13.5 25.5 26.5 37.5" />
    </svg>
  );
}

export function RedoIcon({ className = '' }: IconProps) {
  return <UndoIcon className={`-scale-x-100 ${className}`} />;
}

export function TrashIcon({ className = '' }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={className}>
      <path
        d="M18.5 22 45.5 21 42.5 53.5Q42 56 39.5 56H24.5Q22 56 21.5 53.5Z"
        fill="var(--color-pop-tomato)"
      />
      <path {...STROKE} d="M12.5 21.5Q31 19 51.5 20.5" />
      <path {...STROKE} d="M26 19.5Q25.5 12 32 12 38.5 12 38 19.5" />
      <path {...STROKE} d="M18 22.5 21.5 54Q22 56.5 25 56.5H39.5Q42 56.5 42.5 54L46 21.5" />
      <path {...STROKE} d="M27.5 29 28.5 48M36.5 29 35.5 48" />
    </svg>
  );
}

export function DropperIcon({ className = '', ink = 'currentColor' }: InkIconProps) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={className}>
      <path
        d="M40.5 11.5Q47 4.5 53.5 10.5 59.5 17 52.5 23.5L47.5 28 36 16.5Z"
        fill="var(--color-pop-purple)"
      />
      <path d="M17 44 29 32 33 36 21 48 13 53Z" fill={ink} />
      <path {...STROKE} d="M36 16Q44.5 4 52 9 60 15.5 48 28" />
      <path {...STROKE} d="M32.5 19.5 44.5 31.5" />
      <path {...STROKE} d="M37.5 24 15 46.5 10.5 54.5 18.5 50 41 27.5" />
    </svg>
  );
}

export function KeyboardIcon({ className = '' }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={className}>
      <path {...STROKE} d="M8 20.5Q32 18.5 56.5 20 57.5 32 56 45.5 32 47 7.5 45.5 6.5 32 8 20.5" />
      <path
        {...STROKE}
        strokeWidth={5.5}
        d="M16 29h.1M24 29h.1M32 29h.1M40 29h.1M48 29h.1M16.5 37.5h.1M47.5 37.5h.1M24 37.5H40"
      />
    </svg>
  );
}
