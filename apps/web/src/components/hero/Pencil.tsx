/**
 * A yellow pencil, drawn tip-left, split into two layers with the same box: the body (painted
 * behind the logo letters) and the sharpened tip (painted in front), so it reads as lying across
 * the logo without hiding it. Place both with the same classes.
 */

const INK = 'var(--color-ink)';
const VIEW_BOX = '0 0 440 44';

type LayerProps = { className?: string };

export function PencilBody({ className }: LayerProps) {
  return (
    <svg viewBox={VIEW_BOX} className={className} aria-hidden="true" overflow="visible">
      <g stroke={INK} strokeWidth="3" strokeLinejoin="round">
        <rect x="80" y="2" width="284" height="40" fill="#ffc93c" />
        <rect x="80" y="2" width="284" height="12" fill="#ffe07a" stroke="none" />
        <rect x="80" y="30" width="284" height="12" fill="#eaa61c" stroke="none" />
        <line x1="80" y1="14" x2="364" y2="14" strokeWidth="2" />
        <line x1="80" y1="30" x2="364" y2="30" strokeWidth="2" />
        <rect x="80" y="2" width="284" height="40" fill="none" />
        <rect x="364" y="1" width="34" height="42" fill="#c9ced6" />
        <line x1="375" y1="1" x2="375" y2="43" strokeWidth="2" />
        <line x1="387" y1="1" x2="387" y2="43" strokeWidth="2" />
        <path d="M398 2h24a16 16 0 0 1 16 16v8a16 16 0 0 1-16 16h-24z" fill="#ff8fab" />
      </g>
    </svg>
  );
}

export function PencilTip({ className }: LayerProps) {
  return (
    <svg viewBox={VIEW_BOX} className={className} aria-hidden="true" overflow="visible">
      <g stroke={INK} strokeWidth="3" strokeLinejoin="round">
        {/* Shaved wood, scalloped where it meets the paint. */}
        <path d="M24 15L80 2c-6 4-6 9 0 13c-6 4-6 10 0 14c-6 4-6 9 0 13L24 29z" fill="#f1c890" />
        <path d="M1 22L24 15v14z" fill={INK} />
      </g>
    </svg>
  );
}
