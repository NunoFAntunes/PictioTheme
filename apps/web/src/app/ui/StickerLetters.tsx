import type { CSSProperties } from 'react';

/**
 * Text as the logo's coloured sticker letters (Cherry Bomb One, ink outline), popping on one by
 * one when they mount and hopping when you point at them. The room's name (waiting-room RoomTitle)
 * and the winner on the results' podium. Decorative: give the text to screen readers yourself.
 */

export type StickerAlign = 'start' | 'center';

const POPS = [
  'var(--color-pop-purple)',
  'var(--color-pop-tomato)',
  'var(--color-pop-sun)',
  'var(--color-pop-teal)',
  'var(--color-pop-pink)',
];

type Props = {
  name: string;
  align: StickerAlign;
  /** How the letters pop on: one every `stepMs`, each taking `durationMs`. `false`: no pop. */
  pop?: { stepMs: number; durationMs?: number } | false;
};

export function StickerLetters({ name, align, pop = { stepMs: 45 } }: Props) {
  const justify = align === 'start' ? 'justify-start' : 'justify-center';
  let index = 0;
  return (
    <span aria-hidden="true" className={`flex flex-wrap gap-x-[0.3em] ${justify}`}>
      {name.split(/\s+/).map((word, w) => (
        <span key={w} className={`inline-flex flex-wrap ${justify}`}>
          {[...word].map((char) => {
            const i = index++;
            return (
              <span
                key={i}
                className={`inline-block ${pop ? 'motion-safe:animate-sticker-pop' : ''}`}
                style={
                  {
                    animationDelay: pop ? `${i * pop.stepMs}ms` : undefined,
                    animationDuration: pop && pop.durationMs ? `${pop.durationMs}ms` : undefined,
                    '--drop-spin': `${(i % 2 ? 1 : -1) * (20 + ((i * 37) % 40))}deg`,
                  } as CSSProperties
                }
              >
                <span
                  className="inline-block px-[0.01em] transition-transform duration-150 [paint-order:stroke_fill] [text-shadow:0.05em_0.06em_0_var(--color-ink)] [-webkit-text-stroke:0.07em_var(--color-ink)] motion-safe:hover:-translate-y-[0.12em] motion-safe:hover:rotate-[var(--tilt)]"
                  style={
                    {
                      color: POPS[i % POPS.length],
                      '--tilt': `${i % 2 ? 8 : -8}deg`,
                    } as CSSProperties
                  }
                >
                  {char}
                </span>
              </span>
            );
          })}
        </span>
      ))}
    </span>
  );
}
