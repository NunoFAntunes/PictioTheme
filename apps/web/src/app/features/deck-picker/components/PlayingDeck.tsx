import { CHAOS_MIN_CARDS, type DeckSummary, type RoomDeck } from '@pictiotheme/protocol';
import { DeckCover } from '../../deck-cover';

/**
 * The room's deck, at the top of the open notebook's first page (DeckChooser): its cover taped in,
 * its title and what it's about. The description and card count come from the library when the
 * deck is in it (`summary`).
 */
export function PlayingDeck({
  deck,
  summary,
}: {
  deck: RoomDeck | null;
  summary: DeckSummary | undefined;
}) {
  if (!deck) {
    return <p className="font-hand text-lg text-ink/60">No deck yet: pick one →</p>;
  }
  const cards = summary ? summary.counts.easy + summary.counts.hard + summary.counts.chaos : null;
  return (
    <div className="flex items-start gap-3">
      <div className="relative mt-1.5 w-16 shrink-0 -rotate-3 @[40rem]:w-20">
        <DeckCover deck={deck} size="fill" />
        <Tape className="-top-1.5 left-1/2 -translate-x-1/2 -rotate-6" />
      </div>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-xs font-semibold tracking-wide text-ink/50 uppercase">
          Now playing
        </span>
        <h3 className="font-hand text-xl leading-tight text-ink">{deck.title}</h3>
        {summary?.description && (
          <p className="line-clamp-2 text-sm leading-snug text-ink/70 @[40rem]:line-clamp-3">
            {summary.description}
          </p>
        )}
        {cards !== null && (
          <p className="text-xs text-ink/55">
            {cards} cards
            {deck.chaosCards >= CHAOS_MIN_CARDS && ' · 🌀'}
          </p>
        )}
      </div>
    </div>
  );
}

const TAPE_COLOURS = ['bg-pop-sun/55', 'bg-pop-pink/45', 'bg-pop-purple/30'] as const;

/** A strip of washi tape holding something onto the page. Place it with `className`. */
export function Tape({ className, colour = 0 }: { className: string; colour?: number }) {
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute h-3.5 w-9 border-x border-dashed border-ink/15 ${TAPE_COLOURS[colour % TAPE_COLOURS.length]} ${className}`}
    />
  );
}
