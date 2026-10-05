/**
 * A sheet of paper scrunched into a ball, drawn like the desk's props: ink outline, flat facets
 * shaded away from the light (top-left), and a scrap of the sheet's red margin line. The close-room
 * button wears a small one; closing the room crumples the room into a big one (features/close-room).
 */
export function PaperBall({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className={className}>
      <path
        d="M50 8 63 13 71 11 82 22 87 35 93 47 88 60 90 70 79 81 66 87 55 93 42 88 29 87 19 76 10 64 8 50 14 38 13 26 25 17 37 14Z"
        fill="var(--color-paper)"
      />
      <g fill="var(--color-ink)">
        <path d="M55 66 68 42 80 58 79 81 66 87Z" opacity="0.16" />
        <path d="M68 42 87 35 93 47 88 60 80 58Z" opacity="0.1" />
        <path d="M36 62 55 66 50 80 42 88 29 87 19 76Z" opacity="0.11" />
        <path d="M30 44 36 62 19 76 10 64 8 50 14 38Z" opacity="0.05" />
      </g>
      <path d="M58 72 72 52" stroke="var(--color-pop-tomato)" strokeOpacity="0.5" strokeWidth="2" />
      <g
        fill="none"
        stroke="var(--color-ink)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.55"
      >
        <path d="M37 14 44 30 55 30 63 13M55 30 68 42 87 35M44 30 30 44 14 38M30 44 36 62 19 76" />
        <path d="M36 62 55 66 68 42M55 66 66 87M55 66 50 80 42 88M68 42 80 58 88 60M80 58 79 81" />
      </g>
      <path
        d="M50 8 63 13 71 11 82 22 87 35 93 47 88 60 90 70 79 81 66 87 55 93 42 88 29 87 19 76 10 64 8 50 14 38 13 26 25 17 37 14Z"
        fill="none"
        stroke="var(--color-ink)"
        strokeWidth="4.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
