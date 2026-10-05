import type { DeckSummary } from '@pictiotheme/protocol';
import { Fragment, useEffect, useId, useState } from 'react';
import { DeckCover } from '../../deck-cover';
import { RedrawCoverPanel } from '../../generate-deck';
import { useDeckSearch } from '../api';

/**
 * The deck picker (user-flows.md §4, next-features.md 1.9): a grid of deck covers, for the host in the waiting room. Without a search,
 * your generated decks, then the featured (seasonal) curated decks, then the rest. Searching
 * matches titles and tags across all public decks.
 */

const SEARCH_DEBOUNCE_MS = 250;
/** Decks shown per section before "Show all": a row or two in the waiting room. */
const COLLAPSED_COUNT = 4;

type Props = {
  curated: DeckSummary[];
  mine: DeckSummary[];
  selectedId: string | null;
  onSelect: (deck: DeckSummary) => void;
};

function useDebounced(value: string, ms: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

export function DeckPicker({ curated, mine, selectedId, onSelect }: Props) {
  const [query, setQuery] = useState('');
  const [redrawing, setRedrawing] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const search = useDeckSearch(useDebounced(query, SEARCH_DEBOUNCE_MS));
  const searchId = useId();
  const mineIds = new Set(mine.map((d) => d.id));
  const searching = query.trim() !== '';

  const sections: { title: string; decks: DeckSummary[] }[] = searching
    ? [{ title: 'Results', decks: search.data ?? [] }]
    : [
        { title: 'Your decks', decks: mine },
        { title: 'Featured', decks: curated.filter((d) => d.featured) },
        { title: 'More decks', decks: curated.filter((d) => !d.featured) },
      ];

  return (
    <div className="flex flex-col gap-3">
      <label htmlFor={searchId} className="sr-only">
        Search decks
      </label>
      <input
        id={searchId}
        type="search"
        value={query}
        maxLength={60}
        placeholder="🔍 Search decks: halloween, space, food…"
        onChange={(e) => setQuery(e.target.value)}
        // Inside the create-room form: Enter searches, it doesn't create the room.
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.preventDefault();
        }}
        className="rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
      />
      {searching && search.isSuccess && search.data.length === 0 && (
        <p className="text-sm text-zinc-500">No decks match “{query.trim()}”.</p>
      )}
      {sections
        .filter((s) => s.decks.length > 0)
        .map((section) => {
          const open = searching || expanded.has(section.title);
          // Collapsed: the first few, plus the selected deck so it's never hidden.
          const shown = open
            ? section.decks
            : section.decks.filter(
                (d, i) => i < COLLAPSED_COUNT || d.id === selectedId || d.id === redrawing,
              );
          const hidden = section.decks.length - shown.length;
          return (
            <section key={section.title} aria-label={section.title} className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                {section.title}
              </h3>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-2">
                {shown.map((deck) => (
                  <Fragment key={deck.id}>
                    <DeckTile
                      deck={deck}
                      selected={selectedId === deck.id}
                      mine={mineIds.has(deck.id)}
                      onSelect={() => onSelect(deck)}
                      onRedraw={() => setRedrawing(deck.id)}
                    />
                    {redrawing === deck.id && (
                      <div className="col-span-full">
                        <RedrawCoverPanel deck={deck} onClose={() => setRedrawing(null)} />
                      </div>
                    )}
                  </Fragment>
                ))}
              </div>
              {hidden > 0 && (
                <button
                  type="button"
                  onClick={() => setExpanded((e) => new Set(e).add(section.title))}
                  className="self-start text-sm text-brand-700 underline dark:text-brand-500"
                >
                  Show all {section.decks.length} decks
                </button>
              )}
            </section>
          );
        })}
    </div>
  );
}

function DeckTile({
  deck,
  selected,
  mine,
  onSelect,
  onRedraw,
}: {
  deck: DeckSummary;
  selected: boolean;
  mine: boolean;
  onSelect: () => void;
  onRedraw: () => void;
}) {
  const { counts } = deck;
  return (
    <div className="relative">
      <label
        title={deck.description}
        className={`flex h-full cursor-pointer flex-col items-center gap-1.5 rounded-lg border p-2 text-center ${
          selected
            ? 'border-brand-600 bg-brand-600/5 ring-1 ring-brand-600'
            : 'border-zinc-200 dark:border-zinc-800'
        }`}
      >
        <input
          type="radio"
          name="deck"
          value={deck.id}
          checked={selected}
          onChange={onSelect}
          className="sr-only"
        />
        <DeckCover deck={deck} size="md" />
        <span className="line-clamp-2 text-sm leading-tight font-medium">{deck.title}</span>
        {mine && (
          <span className="rounded bg-brand-600/10 px-1.5 py-0.5 text-xs text-brand-700 dark:text-brand-500">
            ✨ yours
          </span>
        )}
        <span className="text-xs text-zinc-500">
          {counts.easy + counts.medium + counts.hard + counts.silly} cards
          {counts.silly > 0 && ' · 🤪'}
        </span>
      </label>
      {mine && (
        <button
          type="button"
          onClick={onRedraw}
          aria-label={`Redraw the cover of ${deck.title}`}
          title="Redraw the cover"
          className="absolute top-1 right-1 rounded-md bg-white/90 px-1.5 py-0.5 text-sm shadow-sm ring-1 ring-black/10 hover:bg-white dark:bg-zinc-900/90"
        >
          ✏️
        </button>
      )}
    </div>
  );
}
