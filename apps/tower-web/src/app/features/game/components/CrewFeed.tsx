import { useEffect, useRef } from 'react';
import type { RoomView } from '../../../realtime';

/** Your crew's guesses (the other crew never sees them), newest at the bottom. */
export function CrewFeed({ view }: { view: RoomView }) {
  const list = useRef<HTMLOListElement>(null);
  const names = new Map(view.players.map((p) => [p.id, p.name]));
  useEffect(() => {
    list.current?.lastElementChild?.scrollIntoView({ block: 'nearest' });
  }, [view.feed.length]);
  return (
    <ol
      ref={list}
      aria-label="Your crew's guesses"
      aria-live="polite"
      className="min-h-0 flex-1 space-y-1 overflow-y-auto rounded-md bg-blueprint-950/50 p-2 text-sm"
    >
      {view.feed.length === 0 && (
        <li className="text-chalk-dim">Your crew's guesses show up here.</li>
      )}
      {view.feed.map((f) => {
        const who = f.playerId === view.you ? 'You' : (names.get(f.playerId) ?? '?');
        const steal = f.target === 'steal' ? '🦝 ' : '';
        if (f.text === null) {
          return (
            <li key={f.key} className="font-semibold text-hazard">
              {steal}
              {who} got it!
            </li>
          );
        }
        return (
          <li key={f.key} className={f.result === 'close' ? 'text-safety' : ''}>
            <span className="font-semibold text-chalk-dim">{who}:</span> {steal}
            {f.text}
            {f.result === 'close' && <span className="ml-1 font-semibold">so close!</span>}
          </li>
        );
      })}
    </ol>
  );
}
