import { useEffect, useSyncExternalStore } from 'react';
import type { Loop } from '../loops/paint';
import { Art } from './Art';
import { LoopCanvas } from './LoopCanvas';

type Label = { icon: string; name: string; effect: string };

/**
 * A powers page (the curses, the spells): the list of them on the right, each one a button, and
 * the picture on the left acting out the one picked. Until the reader picks one, the picture
 * tours them all in turn, a loop each, and the list follows it. The picture and the list are in
 * different parts of the page, so they share the pick through a little store, started afresh
 * whenever the page shows.
 */
export function powerPage<K extends string>({
  keys,
  loops,
  labels,
  listName,
}: {
  keys: readonly K[];
  loops: Record<K, Loop>;
  labels: Record<K, Label>;
  /** What the list is called, for screen readers. */
  listName: string;
}) {
  let state = { index: 0, picked: false };
  const listeners = new Set<() => void>();
  const set = (next: typeof state) => {
    state = next;
    for (const l of listeners) l();
  };
  const usePick = () =>
    useSyncExternalStore(
      (l) => {
        listeners.add(l);
        return () => listeners.delete(l);
      },
      () => state,
      () => state,
    );

  function Picture() {
    const { index } = usePick();
    // Each visit starts the tour from the first one.
    useEffect(() => set({ index: 0, picked: false }), []);
    const key = keys[index] ?? keys[0];
    if (!key) return null;
    return (
      <Art bare>
        <LoopCanvas
          loop={loops[key]}
          onLoop={() => {
            if (!state.picked) set({ index: (state.index + 1) % keys.length, picked: false });
          }}
        />
      </Art>
    );
  }

  function List() {
    const { index } = usePick();
    return (
      <ul aria-label={listName} className="space-y-1">
        {keys.map((key, i) => (
          <li key={key}>
            <button
              type="button"
              aria-pressed={i === index}
              onClick={() => set({ index: i, picked: true })}
              className={`flex w-full items-baseline gap-1.5 rounded-lg px-2 py-0.5 text-left text-[0.8125rem] leading-snug transition ${
                i === index ? 'bg-ink text-cloud' : 'hover:bg-card-dark'
              }`}
            >
              <span aria-hidden="true" className="text-sm">
                {labels[key].icon}
              </span>
              <span
                className={`shrink-0 font-display tracking-wide ${i === index ? 'text-sun' : 'text-ink'}`}
              >
                {labels[key].name}
              </span>
              <span className={i === index ? 'text-cloud/85' : 'text-ink/70'}>
                {labels[key].effect}
              </span>
            </button>
          </li>
        ))}
      </ul>
    );
  }

  return { Picture, List };
}
