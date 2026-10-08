import type { ReactNode } from 'react';
import { amHost, sendToRoom, useRoomStore, type RoomView } from '../../../realtime';
import { DeckChooser } from '../../deck-picker';
import { DrawYourself } from '../../identity';
import { WaitingRoomMusic } from '../../sound';
import { DOODLE_BUTTON, WOBBLE } from '../../../ui/hand-drawn';
import { PANEL, PANEL_HEADING } from '../../../ui/room-frame';
import { maxMatchMinutes } from '../match-length';
import { RoomCard } from './RoomCard';
import { RoomSettingsForm } from './RoomSettingsForm';

/**
 * Before a match (user-flows.md §5, screens.md §3): the room's card on top (name, public or
 * private, deck, rules, the code to share), then the host's workspace: the deck library (most of
 * the width, scrolling inside) beside the house rules, with Start at the foot of the rules. Players
 * see the rules read-only, under "Waiting for the host to start…".
 *
 * After a match the host gets the same screen from the results ("Change deck & settings"), with
 * `onBack` to return to them and Start reading "Play again".
 */
export function WaitingRoom({ onBack }: { onBack?: () => void } = {}) {
  const view = useRoomStore((s) => s.view);
  if (!view) return null;
  const host = amHost(view);
  const afterMatch = onBack !== undefined;

  return (
    <div className="@container mx-auto flex w-full max-w-6xl flex-col gap-5">
      {afterMatch ? (
        <button
          type="button"
          onClick={onBack}
          className="self-start font-hand text-lg text-ink/70 underline dark:text-zinc-300"
        >
          ← Back to results
        </button>
      ) : (
        <WaitingRoomMusic />
      )}
      <RoomCard view={view} host={host} />
      {!host && <WaitingForHost />}
      {!afterMatch && <DrawYourself roomCode={view.code} startFolded={host} />}

      {host ? (
        <div className="grid gap-4 @[46rem]:grid-cols-[minmax(0,1fr)_21rem] @[46rem]:items-start">
          <DeckChooser
            className="h-[min(42rem,80dvh)]"
            selectedId={view.settings.deckId}
            currentDeck={view.deck}
            language={view.settings.language}
            onSelect={(deckId) => sendToRoom({ t: 'room:settings', settings: { deckId } })}
          />
          <RulesPanel view={view} editable>
            <StartButton view={view} label={afterMatch ? 'Play again ▶' : 'Start game ▶'} />
          </RulesPanel>
        </div>
      ) : (
        <div className="mx-auto w-full max-w-3xl">
          <RulesPanel view={view} editable={false} />
        </div>
      )}
    </div>
  );
}

function RulesPanel({
  view,
  editable,
  children,
}: {
  view: RoomView;
  editable: boolean;
  children?: ReactNode;
}) {
  return (
    <section aria-labelledby="rules-heading" className={PANEL}>
      <h2 id="rules-heading" className={`mb-3 ${PANEL_HEADING}`}>
        House rules{' '}
        {!editable && <span className="font-sans text-sm text-zinc-500">(the host decides)</span>}
      </h2>
      <RoomSettingsForm view={view} editable={editable} />
      {children}
    </section>
  );
}

function WaitingForHost() {
  return (
    <p className="text-center font-hand text-xl text-ink/70 dark:text-zinc-300">
      Waiting for the host to start
      <span className="motion-safe:animate-pulse">…</span>
    </p>
  );
}

/** Start, at the foot of the house rules: the host's last move after setting the room up. */
function StartButton({ view, label }: { view: RoomView; label: string }) {
  const connected = view.players.filter((p) => p.connected).length;
  const deckInLanguage = view.deck !== null && view.deck.language === view.settings.language;
  const canStart = connected >= 2 && deckInLanguage;

  return (
    <div className="mt-4 flex flex-col items-center gap-2 border-t-2 border-dashed border-ink/20 pt-4 dark:border-zinc-600">
      <button
        type="button"
        disabled={!canStart}
        onClick={() => sendToRoom({ t: 'room:start' })}
        className={`${DOODLE_BUTTON} ${WOBBLE[1]} -rotate-1 bg-pop-purple px-8 py-2.5 text-2xl text-white`}
      >
        {label}
      </button>
      <p className="text-center font-hand text-lg text-ink/70 dark:text-zinc-300">
        {view.deck && !deckInLanguage
          ? 'Translate the deck, or pick one in the room’s language, to start'
          : connected < 2
            ? 'Waiting for at least one more player…'
            : `${connected} players here, up to ~${maxMatchMinutes(view.settings, connected)} min`}
      </p>
    </div>
  );
}
