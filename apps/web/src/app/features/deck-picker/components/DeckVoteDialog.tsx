import type { DeckLanguage, DeckSummary } from '@pictiotheme/protocol';
import { useState } from 'react';
import { useMyDecks } from '../../generate-deck';
import { PaperDialog } from '../../../ui/PaperDialog';
import { RULED } from '../../../ui/Notebook';
import { useCommunityDecks, useDecks, useDeckSearch } from '../api';
import { topTags } from '../top-tags';
import { useDebounced } from '../use-debounced';
import { DeckFilters } from './DeckFilters';
import { DeckSection, type TileContext } from './DeckPage';

/**
 * Voting for the next deck (game-rules.md#deck-votes): the library the host picks from, on a sheet
 * of paper, for everyone else. Tapping a deck holds it up on your paddle and closes the sheet, so
 * you see it beside your doodle. Decks with votes show how many; yours is ticked.
 */

const SEARCH_DEBOUNCE_MS = 250;
const CATEGORY_COUNT = 6;

export function DeckVoteDialog({
  open,
  onClose,
  language,
  votedId,
  votes,
  onVote,
}: {
  open: boolean;
  onClose: () => void;
  /** The room's language: decks come in it when they've been translated into it. */
  language: DeckLanguage;
  /** The deck you voted for, if any. */
  votedId: string | null;
  votes: ReadonlyMap<string, number>;
  /** A deck, or null to put your paddle down. */
  onVote: (deckId: string | null) => void;
}) {
  return (
    <PaperDialog
      open={open}
      onClose={onClose}
      title="Vote for the next deck!"
      subtitle="Hold up the deck you’d like to play. The host decides."
      className="w-[min(48rem,calc(100vw-2rem))]"
    >
      {/* Only loaded while open, so the room doesn't fetch the library for nothing. */}
      {open && <VoteLibrary language={language} votedId={votedId} votes={votes} onVote={onVote} />}
    </PaperDialog>
  );
}

function VoteLibrary({
  language,
  votedId,
  votes,
  onVote,
}: {
  language: DeckLanguage;
  votedId: string | null;
  votes: ReadonlyMap<string, number>;
  onVote: (deckId: string | null) => void;
}) {
  const decks = useDecks(language);
  const myDecks = useMyDecks(language);
  const community = useCommunityDecks(language);
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState<string | null>(null);
  const search = useDeckSearch(useDebounced(tag ?? query, tag ? 0 : SEARCH_DEBOUNCE_MS), language);

  const curated = decks.data ?? [];
  const mine = myDecks.data ?? [];
  const mineIds = new Set(mine.map((d) => d.id));
  const communityDecks =
    community.data?.pages.flatMap((p) => p.decks).filter((d) => !mineIds.has(d.id)) ?? [];
  const searching = tag !== null || query.trim() !== '';
  const context: TileContext = {
    language,
    mode: 'normal',
    selectedId: votedId,
    // No ✏️ to redraw covers here: that's for the deck library in your own room.
    mineIds: new Set(),
    onSelect: (deck: DeckSummary) => onVote(deck.id),
    votes,
    voting: true,
  };

  return (
    <div className="@container flex flex-col gap-2">
      {votedId && (
        <button
          type="button"
          onClick={() => onVote(null)}
          className="self-start font-hand text-lg text-ink/70 underline hover:text-ink"
        >
          Put my paddle down
        </button>
      )}
      <DeckFilters
        query={query}
        tag={tag}
        categories={topTags([...mine, ...curated], CATEGORY_COUNT)}
        onQuery={(q) => {
          setQuery(q);
          setTag(null);
        }}
        onTag={(t) => {
          setTag(t);
          setQuery('');
        }}
      />
      <div className={`rounded-lg bg-local px-3 pb-4 ${RULED}`}>
        {searching ? (
          <>
            <DeckSection
              key={tag ?? query}
              title={tag ? `#${tag}` : 'Results'}
              decks={search.data ?? []}
              showAll
              context={context}
            />
            {search.isSuccess && search.data.length === 0 && (
              <p className="py-6 text-center font-hand text-xl text-ink/60">
                {tag ? `No decks tagged #${tag} yet.` : `No decks match “${query.trim()}”.`}
              </p>
            )}
          </>
        ) : (
          <>
            <DeckSection title="Your decks" decks={mine} context={context} />
            {decks.isPending && (
              <p className="py-6 text-center font-hand text-xl text-ink/60">Loading decks…</p>
            )}
            <DeckSection title="Featured" decks={curated} context={context} />
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
          </>
        )}
      </div>
    </div>
  );
}
