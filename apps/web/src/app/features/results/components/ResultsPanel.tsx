import { useState } from 'react';
import { amHost, playerById, sendToRoom, useRoomStore } from '../../../realtime';
import { DOODLE_BUTTON, WOBBLE } from '../../../ui/hand-drawn';
import { BoilFilters } from '../../player-list';
import { DeckCover } from '../../deck-cover';
import { ReportDeckButton } from '../../report-deck';
import { WaitingRoom } from '../../waiting-room';
import { PodiumCeremony } from './PodiumCeremony';

/** End of match: the podium ceremony, then play again (screens.md §6). */
export function ResultsPanel() {
  const view = useRoomStore((s) => s.view);
  const [editing, setEditing] = useState(false);
  // Coming back from the settings shows the podium as it was left, without the show again.
  const [seen, setSeen] = useState(false);
  if (view?.phase.kind !== 'results') return null;
  const { ranking, awards } = view.phase;
  const host = amHost(view);
  // The host sets up the next match on the waiting room's own screen: deck library and rules.
  if (editing && host) return <WaitingRoom onBack={() => setEditing(false)} />;
  const ranked = ranking.flatMap((id) => {
    const player = playerById(view, id);
    return player ? [player] : [];
  });

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-4 py-2">
      {/* The figures boil through these (the player list has them too, but not on every layout). */}
      <BoilFilters />
      <div className="flex items-center gap-3 self-start">
        {view.deck && <DeckCover deck={view.deck} size="sm" />}
        <div>
          <h2 className="text-xs font-bold tracking-widest text-ink/60 uppercase">Results</h2>
          {view.deck && (
            <div className="flex items-center gap-2 font-hand text-lg text-ink">
              {view.deck.title}
              <ReportDeckButton deck={view.deck} />
            </div>
          )}
        </div>
      </div>
      <PodiumCeremony
        players={ranked}
        awards={awards}
        roomCode={view.code}
        live={view.phaseLive && !seen}
      />
      <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
        {host && (
          <>
            <button
              type="button"
              onClick={() => sendToRoom({ t: 'room:start' })}
              className={`${DOODLE_BUTTON} ${WOBBLE[1]} -rotate-1 bg-pop-purple px-6 py-2 text-xl text-white`}
            >
              Play again
            </button>
            <button
              type="button"
              onClick={() => {
                setSeen(true);
                setEditing(true);
              }}
              className="rounded-full border border-zinc-300 px-6 py-2"
            >
              Change deck & settings
            </button>
          </>
        )}
        <a href="/" className="rounded-full border border-zinc-300 px-6 py-2">
          Lobby
        </a>
      </div>
      {!host && <p className="font-hand text-lg text-ink/70">The host can start another match.</p>}
    </div>
  );
}
