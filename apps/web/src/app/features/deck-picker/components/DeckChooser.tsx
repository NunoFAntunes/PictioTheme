import type { DeckLanguage, DeckSummary, RoomDeck } from '@pictiotheme/protocol';
import { useState } from 'react';
import {
  GenerateDeckPanel,
  TranslateDeckPanel,
  useGenerationConfig,
  useMyDecks,
} from '../../generate-deck';
import { PANEL, PANEL_HEADING } from '../../../ui/room-frame';
import { useDecks } from '../api';
import { DeckPicker } from './DeckPicker';

/**
 * Choosing a room's deck (user-flows.md §4): a panel of its own with search, categories and the
 * cover grid, and ✨ Generate a deck when the server allows it. The library keeps its height (give
 * it one with `className`) and scrolls inside, however many decks there are. While generating,
 * the panel grows to fit the form and the cover pad instead, so drawing never scrolls inside a
 * box. A generated deck is chosen as soon as it's ready.
 *
 * Decks are shown in the room's language. A deck that isn't in it yet (picked from the library,
 * or the room's own deck after the host changed the language) gets the translate panel on top:
 * the room switches to the translation once it's ready (decks.md#languages).
 */
export function DeckChooser({
  selectedId,
  currentDeck,
  language,
  onSelect,
  className = '',
}: {
  selectedId: string | null;
  /** The room's deck, once loaded. */
  currentDeck: RoomDeck | null;
  /** The room's language. */
  language: DeckLanguage;
  onSelect: (deckId: string) => void;
  className?: string;
}) {
  const decks = useDecks(language);
  const myDecks = useMyDecks(language);
  const generationEnabled = useGenerationConfig().data?.enabled === true;
  const [generating, setGenerating] = useState(false);
  /** A deck picked from the library that isn't in the room's language. */
  const [toTranslate, setToTranslate] = useState<DeckSummary | null>(null);
  const untranslated: Pick<RoomDeck, 'id' | 'title' | 'coverId' | 'language'> | null =
    toTranslate ?? (currentDeck && currentDeck.language !== language ? currentDeck : null);

  function pick(deck: DeckSummary) {
    if (deck.language === language) {
      setToTranslate(null);
      onSelect(deck.id);
    } else {
      setToTranslate(deck);
    }
  }

  return (
    <section
      aria-labelledby="deck-heading"
      className={`flex min-h-0 flex-col gap-3 ${PANEL} ${generating ? '' : className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="deck-heading" className={PANEL_HEADING}>
          Pick a deck
        </h2>
        {generationEnabled && !generating && (
          <button
            type="button"
            onClick={() => setGenerating(true)}
            className="rounded-full border-2 border-dashed border-brand-600/60 px-3 py-1 text-sm font-medium text-brand-700 hover:bg-brand-600/5 dark:text-brand-500"
          >
            ✨ Generate a deck
          </button>
        )}
      </div>
      {generating ? (
        <GenerateDeckPanel
          language={language}
          onCancel={() => setGenerating(false)}
          onGenerated={(deck) => {
            onSelect(deck.id);
            setGenerating(false);
          }}
        />
      ) : (
        <>
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
          {decks.isPending && <p className="text-sm text-zinc-500">Loading decks…</p>}
          {decks.isError && <p className="text-sm text-close">Couldn’t load decks.</p>}
          <DeckPicker
            curated={decks.data ?? []}
            mine={myDecks.data ?? []}
            language={language}
            selectedId={selectedId}
            onSelect={pick}
          />
        </>
      )}
    </section>
  );
}
