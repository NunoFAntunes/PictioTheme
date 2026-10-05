import { useState } from 'react';
import { GenerateDeckPanel, useGenerationConfig, useMyDecks } from '../../generate-deck';
import { useDecks } from '../api';
import { DeckPicker } from './DeckPicker';

/**
 * Choosing a room's deck (user-flows.md §4): a panel of its own with search, categories and the
 * cover grid, and ✨ Generate a deck when the server allows it. The panel keeps its height (give
 * it one with `className`) and scrolls inside, however many decks there are. A generated deck is
 * chosen as soon as it's ready.
 */
export function DeckChooser({
  selectedId,
  onSelect,
  className = '',
}: {
  selectedId: string | null;
  onSelect: (deckId: string) => void;
  className?: string;
}) {
  const decks = useDecks();
  const myDecks = useMyDecks();
  const generationEnabled = useGenerationConfig().data?.enabled === true;
  const [generating, setGenerating] = useState(false);

  return (
    <section
      aria-labelledby="deck-heading"
      className={`flex min-h-0 flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950 ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="deck-heading" className="text-lg font-semibold">
          🎴 Pick a deck
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
        <div className="min-h-0 flex-1 overflow-y-auto">
          <GenerateDeckPanel
            onCancel={() => setGenerating(false)}
            onGenerated={(deck) => {
              onSelect(deck.id);
              setGenerating(false);
            }}
          />
        </div>
      ) : (
        <>
          {decks.isPending && <p className="text-sm text-zinc-500">Loading decks…</p>}
          {decks.isError && <p className="text-sm text-close">Couldn’t load decks.</p>}
          <DeckPicker
            curated={decks.data ?? []}
            mine={myDecks.data ?? []}
            selectedId={selectedId}
            onSelect={(deck) => onSelect(deck.id)}
          />
        </>
      )}
    </section>
  );
}
