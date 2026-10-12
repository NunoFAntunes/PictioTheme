import { useEffect, useId, useRef, useState } from 'react';
import { loopAt, MarkerLoop } from '../../../ui/MarkerLoop';
import { playSound } from '../../sound';

/**
 * Finding a deck, on the open notebook's first page (DeckChooser): a line to write a search on, and
 * the categories (the most shared tags) as handwritten words. The one you're looking at is circled
 * in marker, like a choice in the house rules beside it: "All" without a search, nothing while you
 * type one.
 */
export function DeckFilters({
  query,
  tag,
  categories,
  onQuery,
  onTag,
}: {
  query: string;
  tag: string | null;
  categories: string[];
  onQuery: (query: string) => void;
  onTag: (tag: string | null) => void;
}) {
  const searchId = useId();
  /** The circled word: a tag, "All" (null) without a search, or nothing while typing one. */
  const circled: string | null | undefined = tag ?? (query.trim() === '' ? null : undefined);
  const [shown, setShown] = useState(circled);
  const [erasing, setErasing] = useState<string | null | undefined>(undefined);
  if (circled !== shown) {
    setErasing(shown);
    setShown(circled);
  }
  const last = useRef(circled);
  useEffect(() => {
    if (last.current === circled) return;
    last.current = circled;
    if (circled !== undefined) playSound('ruleMark');
  }, [circled]);

  const words: { key: string | null; label: string }[] = [
    { key: null, label: 'All' },
    ...categories.map((t) => ({ key: t, label: t })),
  ];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline gap-2 border-b-2 border-dashed border-ink/30 focus-within:border-ink">
        <span aria-hidden="true" className="text-sm">
          🔍
        </span>
        <label htmlFor={searchId} className="sr-only">
          Search decks
        </label>
        <input
          id={searchId}
          type="search"
          value={query}
          maxLength={60}
          placeholder="halloween, space, food…"
          onChange={(e) => onQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.preventDefault();
          }}
          className="min-w-0 flex-1 bg-transparent py-1 font-hand text-xl text-ink outline-none placeholder:text-ink/35"
        />
      </div>
      {categories.length > 0 && (
        <div role="group" aria-label="Categories" className="flex flex-wrap gap-x-1 gap-y-0.5">
          {words.map((w, i) => {
            const on = circled === w.key;
            const loop = loopAt(i);
            return (
              <button
                key={w.key ?? ''}
                type="button"
                aria-pressed={on}
                onClick={() => onTag(on && w.key !== null ? null : w.key)}
                className="group rounded-md px-2 py-0.5 font-hand text-lg leading-tight capitalize focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink focus-visible:outline-dashed pointer-coarse:min-h-11"
              >
                <span
                  className={`relative inline-block ${on ? 'text-ink motion-safe:animate-choice-wiggle' : 'text-ink/60 group-hover:text-ink'}`}
                >
                  {w.label}
                  {on ? (
                    <MarkerLoop key="on" loop={loop} state="on" />
                  ) : erasing === w.key ? (
                    <MarkerLoop
                      key="erasing"
                      loop={loop}
                      state="erasing"
                      onErased={() => setErasing(undefined)}
                    />
                  ) : (
                    <MarkerLoop key="preview" loop={loop} state="preview" />
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
