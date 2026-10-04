import type { RoomDeck } from '@pictiotheme/protocol';
import type { CSSProperties, Ref } from 'react';
import { coverUrl, defaultCoverStyle } from '../../deck-cover';

type BackProps = {
  /** The room's deck: its drawn back cover is shown when it has one. */
  deck?: RoomDeck | null;
  className?: string;
  style?: CSSProperties;
};

/**
 * The back of a playing card: the deck's drawn cover, or its default cover (the title on a
 * coloured, striped tile) when it has none. The game's own ✏️ back is only for when no deck is
 * known. Sizes itself to its parent; the text scales with the card.
 */
export function CardBack({ deck, className = '', style }: BackProps) {
  if (deck?.coverId) {
    return (
      <div
        aria-hidden="true"
        style={style}
        className={`overflow-hidden rounded-lg border-2 border-white bg-white shadow-md ring-1 ring-black/10 dark:border-zinc-200 ${className}`}
      >
        <img
          src={coverUrl(deck.coverId)}
          alt=""
          draggable={false}
          className="size-full object-cover"
        />
      </div>
    );
  }
  if (deck) {
    return (
      <div
        aria-hidden="true"
        style={{ ...defaultCoverStyle(deck.title), ...style }}
        className={`@container flex items-center justify-center overflow-hidden rounded-lg border-2 border-white p-[8%] text-center shadow-md ring-1 ring-black/10 dark:border-zinc-200 ${className}`}
      >
        <span className="line-clamp-4 rounded bg-black/20 px-[4cqw] py-[2cqw] text-[13cqw] leading-tight font-semibold text-white [overflow-wrap:anywhere]">
          {deck.title}
        </span>
      </div>
    );
  }
  return (
    <div
      aria-hidden="true"
      style={style}
      className={`@container flex rounded-lg border-2 border-white bg-linear-135 from-brand-500 to-brand-700 p-[8%] shadow-md ring-1 ring-black/10 dark:border-zinc-200 ${className}`}
    >
      <div className="flex flex-1 items-center justify-center rounded-md border border-white/50">
        <span className="text-[40cqw] leading-none">✏️</span>
      </div>
    </div>
  );
}

const LAYERS = 4;

/** The draw pile in the bottom-left corner of the board. Riffles while `shuffling`. */
export function CardDeck({
  deck,
  shuffling = false,
  ref,
}: {
  deck?: RoomDeck | null;
  shuffling?: boolean;
  ref?: Ref<HTMLDivElement>;
}) {
  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="absolute bottom-3 left-3 aspect-[3/4] w-[min(4.5rem,13cqw)]"
    >
      {Array.from({ length: LAYERS }, (_, i) => (
        <CardBack
          key={i}
          deck={deck}
          // Each layer sits a little higher so the pile looks thick.
          style={{ top: -i * 2, left: i * 2 }}
          className={`absolute size-full motion-reduce:animate-none ${
            shuffling ? (i % 2 ? 'animate-deck-riffle-right' : 'animate-deck-riffle-left') : ''
          }`}
        />
      ))}
    </div>
  );
}
