import type { DeckCoverId } from '@pictiotheme/protocol';
import { defaultCoverStyle } from '../cover-image';

/**
 * A deck's back cover: the drawing its creator made, or a default made from the title (built-in
 * decks, and decks whose creator skipped drawing). Always 3:4, like a playing card.
 */

const SIZES = {
  sm: 'w-9 rounded-md text-base',
  md: 'w-24 rounded-lg text-sm',
  lg: 'w-40 rounded-xl text-lg',
  /** Beside the waiting room's code: about as tall as it, so the page doesn't grow. */
  compact: 'w-20 rounded-lg text-[0.625rem]',
  /** As wide as its container: the deck picker's tiles. */
  fill: 'w-full rounded-lg text-xs',
} as const;

export function coverUrl(id: DeckCoverId): string {
  return `/api/decks/covers/${id}`;
}

type Props = {
  deck: { title: string; coverId: DeckCoverId | null };
  size?: keyof typeof SIZES;
  /** A local drawing to show instead (your own cover, before it's saved). */
  src?: string;
};

export function DeckCover({ deck, size = 'md', src }: Props) {
  const frame = `aspect-[3/4] shrink-0 border border-zinc-200 shadow-sm dark:border-zinc-700 ${SIZES[size]}`;
  const image = src ?? (deck.coverId ? coverUrl(deck.coverId) : null);
  if (image) {
    return (
      <img
        src={image}
        alt={`Cover of ${deck.title}`}
        loading="lazy"
        draggable={false}
        className={`${frame} bg-white object-cover`}
      />
    );
  }
  return (
    <span
      role="img"
      aria-label={`Cover of ${deck.title}`}
      className={`${frame} flex items-center justify-center overflow-hidden p-1.5 text-center font-semibold leading-tight text-white`}
      style={defaultCoverStyle(deck.title)}
    >
      <span
        aria-hidden
        className="line-clamp-4 rounded bg-black/20 px-1 py-0.5 hyphens-auto break-words"
      >
        {size === 'sm' ? ([...deck.title.trim()][0]?.toUpperCase() ?? '?') : deck.title}
      </span>
    </span>
  );
}
