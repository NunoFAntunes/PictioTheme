import { useState } from 'react';
import { GenerateDeckPanel, useGenerationConfig, useMyDecks } from '../../generate-deck';
import { useDecks } from '../api';
import { DeckPicker } from './DeckPicker';

/**
 * Choosing a room's deck (user-flows.md §4): the cover grid with search, and ✨ Generate a deck
 * when the server allows it. A generated deck is chosen as soon as it's ready.
 */
export function DeckChooser({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (deckId: string) => void;
}) {
  const decks = useDecks();
  const myDecks = useMyDecks();
  const generationEnabled = useGenerationConfig().data?.enabled === true;
  const [generating, setGenerating] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      {decks.isPending && <p className="text-sm text-zinc-500">Loading decks…</p>}
      {decks.isError && <p className="text-sm text-close">Couldn’t load decks.</p>}
      <DeckPicker
        curated={decks.data ?? []}
        mine={myDecks.data ?? []}
        selectedId={selectedId}
        onSelect={(deck) => onSelect(deck.id)}
      />
      {generationEnabled &&
        (generating ? (
          <GenerateDeckPanel
            onCancel={() => setGenerating(false)}
            onGenerated={(deck) => {
              onSelect(deck.id);
              setGenerating(false);
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setGenerating(true)}
            className="self-start rounded-lg border border-dashed border-brand-600/60 px-3 py-2 text-sm text-brand-700 hover:bg-brand-600/5 dark:text-brand-500"
          >
            ✨ Generate a deck
          </button>
        ))}
    </div>
  );
}
