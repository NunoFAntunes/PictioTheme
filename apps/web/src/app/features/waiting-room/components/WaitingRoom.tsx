import type { ReactNode } from 'react';
import { amHost, sendToRoom, useRoomStore, type RoomView } from '../../../realtime';
import { DeckChooser } from '../../deck-picker';
import { DrawYourself } from '../../identity';
import { WaitingRoomMusic } from '../../sound';
import { DOODLE_BUTTON, WOBBLE } from '../../../ui/hand-drawn';
import { Notebook } from '../../../ui/Notebook';
import { PANEL_HEADING } from '../../../ui/room-frame';
import { hasChaosCards } from '../chaos';
import { maxMatchMinutes } from '../match-length';
import { RoomCard } from './RoomCard';
import { RoomSettingsForm } from './RoomSettingsForm';
import { ToysAround } from './ToysAround';

/**
 * Before a match (user-flows.md §5, screens.md §3): the room's card on top (name, public or
 * private, deck, rules, the code to share), then the host's workspace: the deck library (a notebook
 * lying open, most of the width, scrolling inside) beside the house rules (a spiral notepad), with
 * Start at the foot of the rules. Players see the rules read-only, under "Waiting for the host to
 * start…", in the middle of toys to play with while they wait.
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
    <div className="@container mx-auto flex w-full max-w-6xl flex-col gap-4">
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
        // Side by side, the deck notebook is as tall as the house rules (it scrolls inside), and
        // its ribbon bookmark dangles into the room left under them.
        <div className="grid gap-4 pb-5 @[46rem]:grid-cols-[minmax(0,1fr)_23rem]">
          <DeckChooser
            className="h-[min(42rem,80dvh)] @[46rem]:h-auto @[46rem]:[contain:size]"
            selectedId={view.settings.deckId}
            currentDeck={view.deck}
            language={view.settings.language}
            mode={view.settings.mode}
            onSelect={(deckId) => sendToRoom({ t: 'room:settings', settings: { deckId } })}
          />
          <RulesPanel view={view} editable>
            <StartButton view={view} label={afterMatch ? 'Play again ▶' : 'Start game ▶'} />
          </RulesPanel>
        </div>
      ) : (
        <ToysAround>
          <RulesPanel view={view} editable={false} />
        </ToysAround>
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
    // A notepad: the heading sits over the pad's red header line, the rules on the ruled lines.
    <Notebook aria-labelledby="rules-heading">
      <h2
        id="rules-heading"
        className={`mb-2 border-b-2 border-pop-tomato/50 pb-1 ${PANEL_HEADING}`}
      >
        House rules{' '}
        {!editable && <span className="font-sans text-sm text-zinc-500">(the host decides)</span>}
      </h2>
      <RoomSettingsForm view={view} editable={editable} />
      {children}
    </Notebook>
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
  const needsChaos = view.settings.mode === 'chaos' && !hasChaosCards(view.deck);
  const canStart = connected >= 2 && deckInLanguage && !needsChaos;

  return (
    <div className="mt-3 flex flex-col items-center gap-1.5 border-t-2 border-dashed border-ink/20 pt-3 dark:border-zinc-600">
      <button
        type="button"
        disabled={!canStart}
        onClick={() => sendToRoom({ t: 'room:start' })}
        className={`${DOODLE_BUTTON} ${WOBBLE[1]} -rotate-1 bg-pop-purple px-8 py-2 text-2xl text-white`}
      >
        {label}
      </button>
      <p className="text-center font-hand text-base text-ink/70 dark:text-zinc-300">
        {view.deck && !deckInLanguage
          ? 'Translate the deck, or pick one in the room’s language, to start'
          : view.deck && needsChaos
            ? 'Make the deck’s Chaos cards, or pick another deck, to start'
            : connected < 2
              ? 'Waiting for at least one more player…'
              : `${connected} players here, up to ~${maxMatchMinutes(view.settings, connected)} min`}
      </p>
    </div>
  );
}
