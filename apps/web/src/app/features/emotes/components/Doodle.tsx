import { DOODLES, type DoodleArt, type DoodleName } from '../doodles';

/** One of the emotes' doodles (doodles.ts) as an icon. Decorative: the button carries the name. */
export function Doodle({ name, className = '' }: { name: DoodleName; className?: string }) {
  const art: DoodleArt = DOODLES[name];
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={className}>
      {art.fills.map((f, i) => (
        <path
          key={`f${i}`}
          d={f.d}
          fill={f.color}
          transform={f.shift && `translate(${f.shift.join(' ')})`}
        />
      ))}
      {art.lines.map((l, i) => (
        <path
          key={`l${i}`}
          d={l.d}
          fill="none"
          stroke={l.color ?? 'currentColor'}
          strokeWidth={l.width ?? 4.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}
