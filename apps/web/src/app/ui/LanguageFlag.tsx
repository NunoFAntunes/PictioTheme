import { deckLanguageInfo } from '@pictiotheme/game-core';
import type { DeckLanguage, DeckLanguageInfo } from '@pictiotheme/protocol';
import { useId } from 'react';
import {
  BR,
  CN,
  CZ,
  DE,
  DK,
  ES,
  FI,
  FR,
  GB,
  GR,
  HU,
  ID,
  IT,
  JP,
  KR,
  MX,
  NL,
  NO,
  PL,
  PT,
  RO,
  RU,
  SE,
  TR,
  TW,
  UA,
  VN,
} from 'country-flag-icons/react/3x2';

/**
 * A language's flag (protocol `DECK_LANGUAGES`), drawn like the desk's doodles: a lopsided ink
 * outline, edges that wobble, a crayon grain and a little tilt. From SVGs, not emoji: Windows shows
 * flag emoji as two letters. Each flag carries its own small SVG filter (displacement for the
 * wobble, speckled alpha for the grain), so there's nothing to mount once per page.
 */

const FLAGS: Record<DeckLanguageInfo['flag'], typeof GB> = {
  BR,
  CN,
  CZ,
  DE,
  DK,
  ES,
  FI,
  FR,
  GB,
  GR,
  HU,
  ID,
  IT,
  JP,
  KR,
  MX,
  NL,
  NO,
  PL,
  PT,
  RO,
  RU,
  SE,
  TR,
  TW,
  UA,
  VN,
};

/** Tilts, picked by the flag's letters so a language always leans the same way. */
const TILTS = ['-rotate-3', 'rotate-2', '-rotate-1', 'rotate-3', 'rotate-1', '-rotate-2'] as const;

export function LanguageFlag({
  language,
  className = 'h-4',
  label = true,
}: {
  language: DeckLanguage;
  /** Sets the size (the flag is 3:2). */
  className?: string;
  /** Whether screen readers hear the language's name; off when it's written beside the flag. */
  label?: boolean;
}) {
  const info = deckLanguageInfo(language);
  const Flag = FLAGS[info.flag];
  const filterId = `flag-drawn-${useId().replace(/[^\w-]/g, '')}`;
  const tilt = TILTS[(info.flag.charCodeAt(0) + info.flag.charCodeAt(1)) % TILTS.length];
  return (
    <span
      role={label ? 'img' : undefined}
      aria-label={label ? info.name : undefined}
      aria-hidden={label ? undefined : true}
      className={`inline-block aspect-[3/2] w-auto shrink-0 ${tilt} ${className}`}
    >
      <svg className="absolute size-0" aria-hidden="true" focusable="false">
        <filter id={filterId} x="-15%" y="-15%" width="130%" height="130%">
          <feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves={2} seed={7} />
          <feDisplacementMap
            in="SourceGraphic"
            scale={2.2}
            xChannelSelector="R"
            yChannelSelector="G"
            result="wobbly"
          />
          <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves={1} seed={3} />
          <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.2 2.3" />
          <feComposite in="wobbly" operator="in" />
        </filter>
      </svg>
      <span
        style={{ filter: `url(#${filterId})` }}
        className="block size-full overflow-hidden rounded-[0.3em_0.12em_0.25em_0.1em/0.12em_0.28em_0.1em_0.3em] shadow-[0_0_0_1.5px_var(--color-ink),1px_1.5px_0_1.5px_var(--color-ink)]"
      >
        <Flag aria-hidden="true" className="block size-full" />
      </span>
    </span>
  );
}
