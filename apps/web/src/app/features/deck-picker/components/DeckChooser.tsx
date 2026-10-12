import {
  CHAOS_MIN_CARDS,
  type DeckLanguage,
  type DeckSummary,
  type GameMode,
  type RoomDeck,
} from '@pictiotheme/protocol';
import { useEffect, useState } from 'react';
import {
  ChaosCardsPanel,
  GenerateDeckPanel,
  TranslateDeckPanel,
  useGenerationConfig,
  useMyDecks,
} from '../../generate-deck';
import { Notebook, NotebookSpread } from '../../../ui/Notebook';
import { PANEL_HEADING } from '../../../ui/room-frame';
import { useCommunityDecks, useDecks, useDeckSearch } from '../api';
import { topTags } from '../top-tags';
import { DeckFilters } from './DeckFilters';
import { DeckSection, NewDeckTile, type TileContext } from './DeckPage';
import { LibraryPages, type SearchResults } from './LibraryPages';
import { PlayingDeck } from './PlayingDeck';

/**
 * Choosing a room's deck (user-flows.md §4, screens.md §3): a notebook lying open beside the house
 * rules' notepad, the coil in the middle. The first page is the host's: the room's deck, the search
 * and categories, and their own decks after a ✨ Generate a deck tile (when the server allows it).
 * The second is the library, taped in: our featured decks, and over the page the community's
 * (LibraryPages). Each page scrolls on its own (give the spread its height with `className`).
 * Without room for two pages it folds, the first on top. Generating turns to a fresh page: a notepad that grows to fit the form and the cover pad, so
 * drawing never scrolls inside a box. A generated deck is chosen as soon as it's ready.
 *
 * Decks are shown in the room's language. A deck that isn't in it yet (picked from the library,
 * or the room's own deck after the host changed the language) gets the translate panel on the
 * first page: the room switches to the translation once it's ready (decks.md#languages).
 *
 * In Chaos mode, a room deck without Chaos cards gets the Chaos panel there instead: any host can
 * have them made, and the room reloads the deck once they're saved (decks.md#chaos-cards).
 */

const SEARCH_DEBOUNCE_MS = 250;
const CATEGORY_COUNT = 6;

function useDebounced(value: string, ms: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

export function DeckChooser({
  selectedId,
  currentDeck,
  language,
  mode,
  onSelect,
  className = '',
}: {
  selectedId: string | null;
  /** The room's deck, once loaded. */
  currentDeck: RoomDeck | null;
  /** The room's language. */
  language: DeckLanguage;
  mode: GameMode;
  onSelect: (deckId: string) => void;
  className?: string;
}) {
  const decks = useDecks(language);
  const myDecks = useMyDecks(language);
  const community = useCommunityDecks(language);
  const generationEnabled = useGenerationConfig().data?.enabled === true;
  const [generating, setGenerating] = useState(false);
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState<string | null>(null);
  const search = useDeckSearch(useDebounced(tag ?? query, tag ? 0 : SEARCH_DEBOUNCE_MS), language);
  /** A deck picked from the library that isn't in the room's language. */
  const [toTranslate, setToTranslate] = useState<DeckSummary | null>(null);
  const untranslated: Pick<RoomDeck, 'id' | 'title' | 'coverId' | 'language'> | null =
    toTranslate ?? (currentDeck && currentDeck.language !== language ? currentDeck : null);
  const needsChaos =
    mode === 'chaos' &&
    !untranslated &&
    currentDeck !== null &&
    currentDeck.chaosCards < CHAOS_MIN_CARDS;

  const curated = decks.data ?? [];
  const mine = myDecks.data ?? [];
  const searching = tag !== null || query.trim() !== '';
  const results: SearchResults | null = searching
    ? {
        title: tag ? `#${tag}` : 'Results',
        decks: search.data ?? [],
        empty:
          search.isSuccess && search.data.length === 0
            ? tag
              ? `No decks tagged #${tag} yet.`
              : `No decks match “${query.trim()}”.`
            : null,
      }
    : null;
  const playing = currentDeck
    ? [...mine, ...curated, ...(search.data ?? [])].find((d) => d.id === currentDeck.id)
    : undefined;

  const context: TileContext = {
    language,
    mode,
    selectedId,
    mineIds: new Set(mine.map((d) => d.id)),
    onSelect: pick,
  };

  function pick(deck: DeckSummary) {
    if (deck.language === language) {
      setToTranslate(null);
      onSelect(deck.id);
    } else {
      setToTranslate(deck);
    }
  }

  const heading = (
    // The heading sits over the page's red header line, like the house rules'.
    <h2 id="deck-heading" className={`border-b-2 border-pop-tomato/50 pb-1 ${PANEL_HEADING}`}>
      {generating ? 'A new deck' : 'Pick a deck'}
    </h2>
  );

  if (generating) {
    return (
      <Notebook aria-labelledby="deck-heading" className="flex flex-col gap-3">
        {heading}
        <GenerateDeckPanel
          language={language}
          onCancel={() => setGenerating(false)}
          onGenerated={(deck) => {
            onSelect(deck.id);
            setGenerating(false);
          }}
        />
      </Notebook>
    );
  }

  return (
    <NotebookSpread
      aria-labelledby="deck-heading"
      className={className}
      first={
        <>
          {heading}
          <PlayingDeck deck={currentDeck} summary={playing} />
          {untranslated && (
            <TranslateDeckPanel
              // A new panel per deck and language, so one's progress never shows on another.
              key={`${untranslated.id}-${language}`}
              deck={untranslated}
              language={language}
              onCancel={toTranslate ? () => setToTranslate(null) : undefined}
              onTranslated={(deck) => {
                setToTranslate(null);
                onSelect(deck.id);
              }}
            />
          )}
          {needsChaos && <ChaosCardsPanel key={currentDeck.id} deck={currentDeck} />}
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
          <DeckSection
            title="Your decks"
            decks={mine}
            leading={generationEnabled && <NewDeckTile onClick={() => setGenerating(true)} />}
            context={context}
          />
        </>
      }
      second={
        <LibraryPages
          curated={{ decks: curated, pending: decks.isPending, error: decks.isError }}
          community={community}
          results={results}
          scrollKey={`${tag ?? ''}|${query}`}
          context={context}
        />
      }
    />
  );
}
