import type { DeckSummary } from '@pictiotheme/protocol';
import { useEffect, useState } from 'react';
import { RULED } from '../../../ui/Notebook';
import { playSound } from '../../sound';
import type { useCommunityDecks } from '../api';
import { DeckPage, DeckSection, type TileContext } from './DeckPage';
import { Ribbon } from './Ribbon';

/**
 * The open notebook's second page (DeckChooser): our curated decks ("Featured"), and over the
 * page, the community's (decks.md#community-decks). A ribbon bookmark dangling from the bottom
 * (Ribbon: press it or pull it down) turns to the other side: the page turns over the coil onto the first page (which keeps what's on it) and
 * the other side is underneath; turning back brings it over from the left. Each side keeps where
 * it was scrolled to. Folded (no coil), the pages fade; with reduced motion, they just swap.
 * A search's results take the page's place, and the ribbon goes while they do.
 */

type Side = 'featured' | 'community';

/** As long as the page-turn animations (global.css). */
const TURN_MS = 700;

const SIDES: Record<
  Side,
  { direction: 'next' | 'back'; label: string; colour: { bg: string; fill: string } }
> = {
  featured: {
    direction: 'next',
    label: 'Turn to the community decks',
    colour: { bg: 'bg-pop-pink', fill: 'fill-pop-pink' },
  },
  community: {
    direction: 'back',
    label: 'Turn back to the featured decks',
    colour: { bg: 'bg-pop-sun', fill: 'fill-pop-sun' },
  },
};

export type SearchResults = {
  title: string;
  decks: DeckSummary[];
  /** What to say when the search found nothing, once it has finished. */
  empty: string | null;
};

export function LibraryPages({
  curated,
  community,
  results,
  scrollKey,
  context,
}: {
  curated: { decks: DeckSummary[]; pending: boolean; error: boolean };
  community: ReturnType<typeof useCommunityDecks>;
  /** A search's results, shown instead of either side; null without one. */
  results: SearchResults | null;
  scrollKey: string;
  context: TileContext;
}) {
  const [side, setSide] = useState<Side>('featured');
  /** Whether the page has been turned yet: the first ribbon sways, later ones flip in. */
  const [turned, setTurned] = useState(false);
  /** The page being turned, while it turns. */
  const [turn, setTurn] = useState<{ from: Side; to: Side } | null>(null);
  useEffect(() => {
    if (!turn) return;
    const timer = setTimeout(() => setTurn(null), TURN_MS);
    return () => clearTimeout(timer);
  }, [turn]);

  function turnTo(to: Side) {
    if (turn || to === side) return;
    playSound('pageTurn');
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!still) setTurn({ from: side, to });
    setSide(to);
    setTurned(true);
  }

  const communityDecks =
    community.data?.pages.flatMap((p) => p.decks).filter((d) => !context.mineIds.has(d.id)) ?? [];
  const communityNote = community.isPending
    ? 'Loading community decks…'
    : community.isError
      ? 'Couldn’t load the community decks.'
      : communityDecks.length === 0
        ? 'No community decks yet. Generate one and draw its cover, and it shows up here for everyone.'
        : null;

  /**
   * Turning to the community, the featured page is the leaf going over (on top, from the right);
   * turning back, the featured page is the leaf coming back (on top, from the left).
   */
  const leaf = (page: Side): string => {
    if (!turn || page !== 'featured') return '';
    return turn.to === 'community'
      ? 'z-20 origin-left backface-hidden motion-safe:animate-page-fade-out @[40rem]:motion-safe:animate-page-turn-over'
      : 'z-20 origin-left backface-hidden motion-safe:animate-page-fade-in @[40rem]:motion-safe:animate-page-turn-back';
  };
  const shown = (page: Side) => results === null && (page === side || turn?.from === page);
  /** A page not showing keeps its place (and its scroll), out of sight; folded, out of the way. */
  const away = 'hidden @[40rem]:invisible @[40rem]:block';
  const pageClass = (page: Side) => `col-start-1 row-start-1 ${shown(page) ? leaf(page) : away}`;

  return (
    <div className="relative flex flex-1 flex-col @[40rem]:min-h-0">
      {results === null && (
        <Ribbon
          // A new ribbon each side, so it flips over as the page turns.
          key={side}
          {...SIDES[side]}
          turned={turned}
          onTurn={() => turnTo(side === 'featured' ? 'community' : 'featured')}
        />
      )}
      {/*
       * The perspective makes this its own layer, so while a page turns the layer goes over the
       * first page (and its sticky headings); otherwise under the coil.
       */}
      <div
        className={`relative grid flex-1 grid-rows-[minmax(0,1fr)] [perspective-origin:0_50%] [perspective:2400px] @[40rem]:min-h-0 ${turn ? 'z-20' : ''}`}
      >
        <DeckPage
          data-testid="deck-scroller"
          aria-hidden={!shown('featured') || turn?.from === 'featured' || undefined}
          inert={!shown('featured') || turn?.from === 'featured'}
          note={curated.pending ? 'Loading decks…' : curated.error ? 'Couldn’t load decks.' : null}
          className={pageClass('featured')}
        >
          <DeckSection title="Featured" decks={curated.decks} showAll context={context} />
        </DeckPage>
        <DeckPage
          aria-hidden={!shown('community') || turn?.from === 'community' || undefined}
          inert={!shown('community') || turn?.from === 'community'}
          note={communityNote}
          className={pageClass('community')}
        >
          <DeckSection
            title="Community"
            aside="newest first"
            decks={communityDecks}
            showAll
            more={
              community.hasNextPage
                ? {
                    onClick: () => void community.fetchNextPage(),
                    loading: community.isFetchingNextPage,
                  }
                : null
            }
            context={context}
          />
        </DeckPage>
        {results && (
          <DeckPage note={results.empty} scrollKey={scrollKey} className="col-start-1 row-start-1">
            <DeckSection
              key={results.title}
              title={results.title}
              decks={results.decks}
              showAll
              context={context}
            />
          </DeckPage>
        )}
        {turn && (
          // The leaf's underside: blank paper, for the half of the turn its front is away.
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute inset-0 z-30 hidden origin-left rounded-r-lg bg-local shadow-[inset_-24px_0_32px_-24px_rgb(0_0_0/0.15)] @[40rem]:block ${RULED} ${
              turn.to === 'community'
                ? 'motion-safe:animate-page-underside-over'
                : 'motion-safe:animate-page-underside-back'
            }`}
          />
        )}
      </div>
    </div>
  );
}
