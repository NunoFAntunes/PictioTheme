import type { CardOption, RoomDeck } from '@pictiotheme/protocol';
import { useCallback, useState, type ReactNode } from 'react';
import {
  amHost,
  drawerIdOf,
  playerName,
  sendToRoom,
  useRoomStore,
  useSecondsLeft,
  type RoomView,
} from '../../../realtime';
import { CardDeck } from './CardDeck';
import { CardTable } from './CardTable';
import { ChosenCard } from './ChosenCard';

/** Overlays on the canvas between and around turns (screens.md §5). */

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="@container absolute inset-0 flex flex-col items-center justify-center gap-4 bg-white/90 p-4 text-center dark:bg-zinc-950/90">
      {children}
    </div>
  );
}

function CardChoice({
  deck,
  options,
  endsAt,
}: {
  deck: RoomDeck | null;
  options: CardOption[];
  endsAt: number;
}) {
  const seconds = useSecondsLeft(endsAt);
  const onPick = (index: number) => sendToRoom({ t: 'turn:choose', index });
  // "Pick from 3" is off: the one card is dealt anyway, and tapping it starts the drawing.
  if (options.length === 1) {
    return (
      <Shell>
        <CardTable
          endsAt={endsAt}
          deck={deck}
          cards={{ options, onPick }}
          header={<h2 className="text-xl font-semibold">Your card</h2>}
          footer={
            <p className="text-sm text-zinc-500 tabular-nums">
              Drawing starts in {seconds}s, or tap the card
            </p>
          }
        />
      </Shell>
    );
  }
  return (
    <Shell>
      <CardTable
        endsAt={endsAt}
        deck={deck}
        cards={{
          options,
          onPick,
          onVote: (index, vote) => sendToRoom({ t: 'turn:vote', index, vote }),
        }}
        header={<h2 className="text-xl font-semibold">Choose what to draw</h2>}
        footer={
          // Room for the 👍/👎 under the cards.
          <p className="mt-9 text-sm text-zinc-500 tabular-nums">
            A random one is picked in {seconds}s
          </p>
        }
      />
    </Shell>
  );
}

function Reveal({
  view,
  word,
  deltas,
}: {
  view: RoomView;
  word: string;
  deltas: Record<string, number>;
}) {
  const gains = Object.entries(deltas).sort((a, b) => b[1] - a[1]);
  return (
    <Shell>
      <CardDeck deck={view.deck} />
      <p className="text-zinc-500">The word was</p>
      <p className="text-3xl font-bold uppercase">{word}</p>
      {gains.length === 0 ? (
        <p className="text-zinc-500">Nobody guessed it.</p>
      ) : (
        <ul className="flex flex-col gap-1 text-sm">
          {gains.map(([id, points]) => (
            <li key={id}>
              {playerName(view, id)} <span className="font-semibold text-solved">+{points}</span>
            </li>
          ))}
        </ul>
      )}
    </Shell>
  );
}

export function TurnOverlay() {
  const view = useRoomStore((s) => s.view);
  // The drawer's card, shown large as choosing turns into drawing (not when joining mid-turn).
  const kind = view?.phase.kind;
  const [prevKind, setPrevKind] = useState(kind);
  const [chosen, setChosen] = useState<string | null>(null);
  const hideChosen = useCallback(() => setChosen(null), []);
  if (prevKind !== kind) {
    setPrevKind(kind);
    const word = view?.secret.word;
    const isDrawer = view && drawerIdOf(view.phase) === view.you;
    setChosen(prevKind === 'choosing' && kind === 'drawing' && isDrawer && word ? word : null);
  }
  if (!view) return null;
  const { phase } = view;

  if (view.paused) {
    return (
      <Shell>
        <p className="text-xl font-semibold">
          {view.paused === 'host' ? '⏸ Paused by the host' : '⏳ Waiting for players…'}
        </p>
        {view.paused === 'host' && amHost(view) && (
          <button
            type="button"
            onClick={() => sendToRoom({ t: 'room:resume' })}
            className="rounded-lg bg-brand-600 px-4 py-2 font-semibold text-white"
          >
            Resume
          </button>
        )}
      </Shell>
    );
  }
  if (phase.kind === 'choosing') {
    if (phase.drawerId === view.you && view.secret.options) {
      return <CardChoice deck={view.deck} options={view.secret.options} endsAt={phase.endsAt} />;
    }
    return (
      <Shell>
        <CardTable
          endsAt={phase.endsAt}
          deck={view.deck}
          cards={{ count: view.settings.wordChoice }}
          header={
            <p className="text-xl">
              <strong>{playerName(view, phase.drawerId)}</strong>{' '}
              {view.settings.wordChoice > 1 ? 'is choosing a card…' : 'is dealt a card…'}
            </p>
          }
        />
      </Shell>
    );
  }
  if (phase.kind === 'reveal')
    return <Reveal view={view} word={phase.word} deltas={phase.deltas} />;
  if (phase.kind === 'drawing' && chosen) return <ChosenCard word={chosen} onDone={hideChosen} />;
  return null;
}
