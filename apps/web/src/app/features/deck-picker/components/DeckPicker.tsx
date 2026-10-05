import type { DeckSummary } from '@pictiotheme/protocol';
import { Fragment, useEffect, useId, useRef, useState } from 'react';
import { DeckCover } from '../../deck-cover';
import { RedrawCoverPanel } from '../../generate-deck';
import { useDeckSearch } from '../api';
import { topTags } from '../top-tags';

/**
 * The deck picker (user-flows.md §4, screens.md §3): a grid of deck covers for the host in the
 * waiting room, scrolling inside its panel. Without a search: your generated decks, then the
 * featured (seasonal) curated decks, then the rest, a couple of rows each until "Show all". The
 * category chips (the most shared tags) and the search box match titles and tags across all
 * public decks.
 */

const SEARCH_DEBOUNCE_MS = 250;
/** Decks shown per section before "Show all": about two rows. */
const COLLAPSED_COUNT = 8;
/** Decks added each time an open section shows more, so thousands never render at once. */
const PAGE_SIZE = 48;
const CATEGORY_COUNT = 6;

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

function CategoryChip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap capitalize transition ${
        on
          ? 'border-ink bg-pop-sun text-ink shadow-[1px_1px_0_var(--color-ink)]'
          : 'border-zinc-300 text-zinc-600 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-300'
      }`}
    >
      {children}
    </button>
  );
}

export function DeckPicker({ curated, mine, selectedId, onSelect }: Props) {
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState<string | null>(null);
  const [redrawing, setRedrawing] = useState<string | null>(null);
  /** How many decks each open section shows, by title. */
  const [shownBy, setShownBy] = useState<Record<string, number>>({});
  const scroller = useRef<HTMLDivElement>(null);
  const typed = query.trim() !== '';
  const search = useDeckSearch(useDebounced(tag ?? query, tag ? 0 : SEARCH_DEBOUNCE_MS));
  const searchId = useId();
  const mineIds = new Set(mine.map((d) => d.id));
  const searching = typed || tag !== null;
  const categories = topTags([...mine, ...curated], CATEGORY_COUNT);

  // A new search or category starts at the top of the list.
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [tag, query]);

  const sections: { title: string; decks: DeckSummary[] }[] = searching
    ? [{ title: tag ? `#${tag}` : 'Results', decks: search.data ?? [] }]
    : [
        { title: 'Your decks', decks: mine },
        { title: 'Featured', decks: curated.filter((d) => d.featured) },
        { title: 'More decks', decks: curated.filter((d) => !d.featured) },
      ];
  const empty = searching && search.isSuccess && search.data.length === 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <label htmlFor={searchId} className="sr-only">
        Search decks
      </label>
      <input
        id={searchId}
        type="search"
        value={query}
        maxLength={60}
        placeholder="🔍 Search decks: halloween, space, food…"
        onChange={(e) => {
          setQuery(e.target.value);
          setTag(null);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.preventDefault();
        }}
        className="rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
      />
      {categories.length > 0 && (
        <div role="group" aria-label="Categories" className="flex flex-wrap gap-1.5">
          <CategoryChip
            on={!searching}
            onClick={() => {
              setTag(null);
              setQuery('');
            }}
          >
            All
          </CategoryChip>
          {categories.map((t) => (
            <CategoryChip
              key={t}
              on={tag === t}
              onClick={() => {
                setTag(tag === t ? null : t);
                setQuery('');
              }}
            >
              {t}
            </CategoryChip>
          ))}
        </div>
      )}

      <div
        ref={scroller}
        className="-mx-1 min-h-0 flex-1 overflow-y-auto overscroll-contain px-1 pb-1"
        data-testid="deck-scroller"
      >
        {empty && (
          <p className="py-6 text-center text-sm text-zinc-500">
            {tag ? `No decks tagged #${tag} yet.` : `No decks match “${query.trim()}”.`}
          </p>
        )}
        {sections
          .filter((s) => s.decks.length > 0)
          .map((section) => {
            const limit = searching
              ? section.decks.length
              : (shownBy[section.title] ?? COLLAPSED_COUNT);
            // The first few, plus the selected deck so it's never hidden.
            const shown = section.decks.filter(
              (d, i) => i < limit || d.id === selectedId || d.id === redrawing,
            );
            const hidden = section.decks.length - shown.length;
            const open = limit > COLLAPSED_COUNT;
            return (
              <section key={section.title} aria-label={section.title} className="pb-3">
                <div className="sticky top-0 z-10 flex items-baseline justify-between gap-2 bg-white/95 py-1.5 backdrop-blur-sm dark:bg-zinc-950/95">
                  <h3 className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                    {section.title}{' '}
                    <span className="font-normal tabular-nums">· {section.decks.length}</span>
                  </h3>
                  {open && (
                    <button
                      type="button"
                      onClick={() =>
                        setShownBy((s) => ({ ...s, [section.title]: COLLAPSED_COUNT }))
                      }
                      className="text-xs text-brand-700 underline dark:text-brand-500"
                    >
                      Show fewer
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-2.5">
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
                    onClick={() =>
                      setShownBy((s) => ({
                        ...s,
                        [section.title]: open ? limit + PAGE_SIZE : PAGE_SIZE,
                      }))
                    }
                    className="mt-2 w-full rounded-lg border border-dashed border-zinc-300 py-1.5 text-sm text-brand-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-brand-500 dark:hover:bg-zinc-900"
                  >
                    {open ? `Show more (${hidden} left)` : `Show all ${section.decks.length} decks`}
                  </button>
                )}
              </section>
            );
          })}
      </div>
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
    <div className="group relative">
      <label
        title={deck.description}
        className={`flex h-full cursor-pointer flex-col gap-1 rounded-xl p-1.5 transition ${
          selected
            ? 'bg-brand-600/10 ring-2 ring-brand-600'
            : 'hover:-translate-y-0.5 hover:bg-zinc-100 dark:hover:bg-zinc-900'
        }`}
      >
        <input
          type="radio"
          name="deck"
          value={deck.id}
          checked={selected}
          onChange={onSelect}
          className="peer sr-only"
        />
        <span className="relative block transition group-hover:-rotate-1 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-600">
          <DeckCover deck={deck} size="fill" />
          {selected && (
            <span className="absolute -top-1.5 -left-1.5 -rotate-6 rounded-full border-2 border-ink bg-pop-sun px-1.5 text-xs font-semibold text-ink shadow-[1px_1px_0_var(--color-ink)]">
              ✓ Playing
            </span>
          )}
        </span>
        <span className="line-clamp-2 text-xs leading-tight font-medium">{deck.title}</span>
        <span className="text-xs text-zinc-500">
          {mine && <span className="text-brand-700 dark:text-brand-500">✨ yours · </span>}
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
          className="absolute top-2.5 right-2.5 rounded-md bg-white/90 px-1.5 py-0.5 text-sm shadow-sm ring-1 ring-black/10 hover:bg-white dark:bg-zinc-900/90"
        >
          ✏️
        </button>
      )}
    </div>
  );
}
