import {
  CHAOS_MIN_CARDS,
  type DeckLanguage,
  type DeckSummary,
  type GameMode,
} from '@pictiotheme/protocol';
import { Fragment, useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { LanguageFlag } from '../../../ui/LanguageFlag';
import { MarkerLoop, loopAt } from '../../../ui/MarkerLoop';
import { RULED } from '../../../ui/Notebook';
import { DeckCover } from '../../deck-cover';
import { RedrawCoverPanel } from '../../generate-deck';
import { Tape } from './PlayingDeck';

/**
 * The deck library's pieces (user-flows.md §4, screens.md §3), taped into the open notebook
 * (DeckChooser, LibraryPages): a page of sections (DeckPage), a section of covers (DeckSection)
 * and the covers themselves. Decks come in the room's language when they've been translated into
 * it; the others are marked, and picking one asks to translate it first (DeckChooser). Decks with
 * Chaos cards show 🌀; in Chaos mode, the ones without are marked too: picking one asks to make
 * them. The room's deck is circled in marker.
 */

/** Decks shown per section before "Show all": about two rows. */
const COLLAPSED_COUNT = 8;
/** Decks added each time an open section shows more, so thousands never render at once. */
const PAGE_SIZE = 48;

/** A little lopsided, like covers taped in by hand: each deck always gets the same tilt. */
const TILTS = ['-rotate-2', 'rotate-1', '-rotate-1', 'rotate-2', 'rotate-0'] as const;

function seed(id: string): number {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

/** What every tile needs to know about the room and the host. */
export type TileContext = {
  /** The room's language. */
  language: DeckLanguage;
  mode: GameMode;
  selectedId: string | null;
  /** The host's own (generated) decks, which get ✏️ to redraw their cover. */
  mineIds: ReadonlySet<string>;
  onSelect: (deck: DeckSummary) => void;
  /** How many players voted for each deck (deck-votes), shown on its cover. */
  votes?: ReadonlyMap<string, number> | undefined;
  /**
   * A player voting for the next deck (DeckVoteDialog), not the host picking: the selected deck is
   * their vote, and there are no translate or Chaos hints (the host deals with those).
   */
  voting?: boolean;
};

/**
 * One page of the library: sections of covers, scrolling inside the page (the ruled lines scroll
 * with it; folded, the whole notebook scrolls instead), or a line when there's nothing to show.
 */
export function DeckPage({
  children,
  note,
  scrollKey,
  className = '',
  ...div
}: {
  children: ReactNode;
  /** Said instead of, or before, the sections: loading, nothing found… */
  note?: string | null;
  /** Changes with the search: the page goes back to the top. */
  scrollKey?: string;
  className?: string;
} & Omit<ComponentProps<'div'>, 'children'>) {
  const scroller = useRef<HTMLDivElement>(null);

  // A new search or category starts at the top of the page.
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [scrollKey]);

  return (
    <div
      {...div}
      ref={scroller}
      className={`bg-local px-4 pt-2 pb-6 @[40rem]:min-h-0 @[40rem]:overflow-y-auto @[40rem]:overscroll-contain @[40rem]:rounded-r-lg @[40rem]:pl-8 ${RULED} ${className}`}
    >
      {note && <p className="py-8 text-center font-hand text-xl text-ink/60">{note}</p>}
      {children}
    </div>
  );
}

/**
 * One section of taped-in covers under a sticky handwritten heading: about two rows (plus the
 * room's deck, so it's never hidden) until "Show all", then 48 more at a time. `leading` goes
 * first in the grid (the new-deck tile); without it, an empty section isn't shown.
 */
export function DeckSection({
  title,
  decks,
  showAll = false,
  aside,
  leading,
  more,
  context,
}: {
  title: string;
  decks: DeckSummary[];
  /** Show every deck at once (a short list, or one the server pages: see `more`). */
  showAll?: boolean;
  /** Said beside the title instead of how many decks there are (for a list the server pages). */
  aside?: string;
  leading?: ReactNode;
  /** The server has more: a button at the foot to load them. */
  more?: { onClick: () => void; loading: boolean } | null;
  context: TileContext;
}) {
  const { language, mode, selectedId, mineIds, onSelect, votes, voting = false } = context;
  const [redrawing, setRedrawing] = useState<string | null>(null);
  const [limit, setLimit] = useState(COLLAPSED_COUNT);
  if (decks.length === 0 && !leading) return null;

  const max = showAll ? decks.length : limit;
  const shown = decks.filter((d, i) => i < max || d.id === selectedId || d.id === redrawing);
  const hidden = decks.length - shown.length;
  const open = !showAll && limit > COLLAPSED_COUNT;
  return (
    <section aria-label={title} className="pb-3">
      <div className="sticky top-0 z-10 -mx-1 flex items-baseline justify-between gap-2 border-b-2 border-pop-tomato/40 bg-paper px-1 pt-3 pb-0.5">
        <h3 className="font-hand text-xl leading-tight text-ink">
          {title}{' '}
          {(aside ?? decks.length > 0) && (
            <span className="font-sans text-xs text-ink/45 tabular-nums">
              · {aside ?? decks.length}
            </span>
          )}
        </h3>
        {open && (
          <button
            type="button"
            onClick={() => setLimit(COLLAPSED_COUNT)}
            className="font-hand text-base text-ink/60 underline hover:text-ink"
          >
            Show fewer
          </button>
        )}
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-x-3 gap-y-2 pt-3">
        {leading}
        {shown.map((deck) => (
          <Fragment key={deck.id}>
            <DeckTile
              deck={deck}
              selected={selectedId === deck.id}
              mine={mineIds.has(deck.id)}
              votes={votes?.get(deck.id) ?? 0}
              voting={voting}
              needsTranslation={!voting && deck.language !== language}
              needsChaos={!voting && mode === 'chaos' && deck.counts.chaos < CHAOS_MIN_CARDS}
              onSelect={() => onSelect(deck)}
              onRedraw={() => setRedrawing(deck.id)}
            />
            {redrawing === deck.id && (
              <RedrawCoverPanel deck={deck} onClose={() => setRedrawing(null)} />
            )}
          </Fragment>
        ))}
      </div>
      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setLimit(open ? limit + PAGE_SIZE : PAGE_SIZE)}
          className="mt-2 w-full rounded-lg border-2 border-dashed border-ink/20 py-1 font-hand text-lg text-ink/70 hover:border-ink/40 hover:text-ink"
        >
          {open ? `Show more (${hidden} left)` : `Show all ${decks.length} decks`}
        </button>
      )}
      {more && (
        <button
          type="button"
          disabled={more.loading}
          onClick={more.onClick}
          className="mt-2 w-full rounded-lg border-2 border-dashed border-ink/20 py-1 font-hand text-lg text-ink/70 hover:border-ink/40 hover:text-ink disabled:opacity-60"
        >
          {more.loading ? 'Loading…' : 'Show more'}
        </button>
      )}
    </section>
  );
}

/** The first tile of your decks: an empty, dashed page to start a new one on. */
export function NewDeckTile({ onClick }: { onClick: () => void }) {
  return (
    <div className="p-1.5">
      <button
        type="button"
        onClick={onClick}
        className="group mt-1 flex aspect-[3/4] w-full -rotate-1 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-ink/30 p-2 text-center font-hand text-lg leading-tight text-ink/70 transition hover:-translate-y-0.5 hover:rotate-0 hover:border-ink hover:bg-pop-sun/15 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink focus-visible:outline-dashed"
      >
        <span aria-hidden="true" className="text-2xl transition group-hover:scale-110">
          ✨
        </span>
        Generate a deck
      </button>
    </div>
  );
}

function DeckTile({
  deck,
  selected,
  mine,
  votes,
  voting,
  needsTranslation,
  needsChaos,
  onSelect,
  onRedraw,
}: {
  deck: DeckSummary;
  selected: boolean;
  mine: boolean;
  /** Players who voted for it. */
  votes: number;
  /** A player voting: the selected deck is their vote. */
  voting: boolean;
  /** Not in the room's language yet: picking it asks to translate it. */
  needsTranslation: boolean;
  /** Chaos mode, and the deck has no Chaos cards yet: picking it asks to make them. */
  needsChaos: boolean;
  onSelect: () => void;
  onRedraw: () => void;
}) {
  const { counts } = deck;
  const n = seed(deck.id);
  return (
    <div className="group relative">
      <label
        title={deck.description}
        className="flex h-full cursor-pointer flex-col gap-1 rounded-xl p-1.5"
      >
        <input
          type="radio"
          name={voting ? 'deck-vote' : 'deck'}
          value={deck.id}
          checked={selected}
          onChange={onSelect}
          className="peer sr-only"
        />
        <span
          className={`relative mt-1 block transition peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-ink peer-focus-visible:outline-dashed ${
            selected
              ? 'rotate-0'
              : `${TILTS[n % TILTS.length]} group-hover:-translate-y-0.5 group-hover:rotate-0`
          }`}
        >
          <DeckCover deck={deck} size="fill" />
          <Tape
            colour={n}
            className={`-top-1.5 left-1/2 -translate-x-1/2 ${n % 2 ? 'rotate-3' : '-rotate-3'}`}
          />
          {selected && (
            <>
              <MarkerLoop
                loop={loopAt(n)}
                state="on"
                className="-top-2 -left-2.5 h-[calc(100%+1rem)] w-[calc(100%+1.25rem)]"
              />
              <span className="absolute -bottom-1.5 -left-1.5 -rotate-6 rounded-full border-2 border-ink bg-pop-sun px-1.5 text-xs font-semibold text-ink shadow-[1px_1px_0_var(--color-ink)]">
                {voting ? '✓ Your vote' : '✓ Playing'}
              </span>
            </>
          )}
          {votes > 0 && (
            <span
              data-testid="deck-votes"
              title={`${votes} ${votes === 1 ? 'vote' : 'votes'} to play it next`}
              className="absolute -right-1.5 -bottom-1.5 rotate-6 rounded-full border-2 border-ink bg-pop-pink px-1.5 text-xs font-semibold text-white shadow-[1px_1px_0_var(--color-ink)]"
            >
              🙋 {votes}
            </span>
          )}
        </span>
        <span className="mt-1 line-clamp-2 font-hand text-base leading-tight text-ink">
          {deck.title}
        </span>
        <span className="text-xs text-ink/55">
          {mine && <span className="text-pop-purple">✨ yours · </span>}
          {counts.easy + counts.hard + counts.chaos} cards
          {counts.chaos >= CHAOS_MIN_CARDS && ' · 🌀'}
        </span>
        {needsChaos && !needsTranslation && (
          <span
            data-testid="needs-chaos"
            title="No Chaos cards yet: picking it lets you make them"
            className="text-xs whitespace-nowrap text-pop-pink"
          >
            🌀 to make
          </span>
        )}
        {needsTranslation && (
          <span
            data-testid="needs-translation"
            title="Not in the room’s language yet: picking it translates it first"
            className="flex items-center gap-1 text-xs whitespace-nowrap text-pop-purple"
          >
            <LanguageFlag language={deck.language} className="h-3" />
            to translate
          </span>
        )}
      </label>
      {mine && (
        <button
          type="button"
          onClick={onRedraw}
          aria-label={`Redraw the cover of ${deck.title}`}
          title="Redraw the cover"
          className="absolute top-3 right-2.5 rounded-md border border-ink/40 bg-paper px-1.5 py-0.5 text-sm shadow-[1px_1px_0_var(--color-ink)] hover:bg-pop-sun/40"
        >
          ✏️
        </button>
      )}
    </div>
  );
}
