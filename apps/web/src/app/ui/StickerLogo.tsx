import type { CSSProperties } from 'react';

const NAME = 'DoodleWhirl!';
const POPS = [
  'var(--color-pop-purple)',
  'var(--color-pop-tomato)',
  'var(--color-pop-sun)',
  'var(--color-pop-teal)',
  'var(--color-pop-pink)',
];

/**
 * The home page's logo, small: the same coloured sticker letters, linking home. It shares the
 * `logo` view-transition name with the hero logo, so entering a room shrinks the logo into the
 * header instead of swapping pages (global.css). Letters hop when you point at them.
 */
export function StickerLogo() {
  return (
    <a
      href="/"
      className="inline-flex font-logo text-[1.7rem] leading-none text-ink [view-transition-name:logo] focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-ink"
    >
      <span className="sr-only">{NAME}</span>
      <span aria-hidden="true" className="inline-flex">
        {[...NAME].map((char, i) => (
          <span
            key={i}
            className="inline-block px-[0.01em] transition-transform duration-150 [paint-order:stroke_fill] [text-shadow:0.05em_0.06em_0_var(--color-ink)] [-webkit-text-stroke:0.07em_var(--color-ink)] motion-safe:hover:-translate-y-[0.12em] motion-safe:hover:rotate-[var(--tilt)]"
            style={
              {
                color: POPS[i % POPS.length],
                '--tilt': `${i % 2 ? 8 : -8}deg`,
                marginLeft: i === 6 ? '0.18em' : undefined,
              } as CSSProperties
            }
          >
            {char}
          </span>
        ))}
      </span>
    </a>
  );
}
