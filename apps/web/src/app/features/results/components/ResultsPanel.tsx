import type { Award } from '@pictiotheme/protocol';
import { useState } from 'react';
import { amHost, playerById, sendToRoom, useRoomStore } from '../../../realtime';
import { Avatar } from '../../avatar';
import { DeckCover } from '../../deck-cover';
import { ReportDeckButton } from '../../report-deck';
import { RoomSettingsForm, RoomTitle } from '../../waiting-room';

const AWARD_LABEL: Record<Award['id'], string> = {
  fastest_guesser: '⚡ Fastest guesser',
  best_drawer: '🎨 Best drawer',
};
const MEDALS = ['🥇', '🥈', '🥉'];

/** End of match: podium, table, awards, play again (screens.md §6). */
export function ResultsPanel() {
  const view = useRoomStore((s) => s.view);
  const [editing, setEditing] = useState(false);
  if (view?.phase.kind !== 'results') return null;
  const { ranking, awards } = view.phase;
  const host = amHost(view);
  const ranked = ranking.flatMap((id) => {
    const player = playerById(view, id);
    return player ? [player] : [];
  });

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-6 py-4">
      <div className="flex items-center gap-3">
        {view.deck && <DeckCover deck={view.deck} size="sm" />}
        <div>
          <h2 className="text-2xl font-bold">Results</h2>
          {view.deck && (
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              {view.deck.title}
              <ReportDeckButton deck={view.deck} />
            </div>
          )}
        </div>
      </div>
      <ol className="flex w-full flex-col gap-2">
        {ranked.map((p, i) => (
          <li
            key={p.id}
            className={`flex items-center gap-3 rounded-xl px-4 py-2 ${i === 0 ? 'bg-brand-600/10' : ''}`}
          >
            <span className="w-8 text-xl">{MEDALS[i] ?? `${i + 1}.`}</span>
            <Avatar id={p.avatar} size={i === 0 ? 'xl' : 'lg'} alt={`${p.name}'s avatar`} />
            <span className="flex-1 font-medium">{p.name}</span>
            <span className="text-lg font-semibold tabular-nums">{p.score}</span>
          </li>
        ))}
      </ol>
      {awards.length > 0 && (
        <ul className="flex flex-wrap justify-center gap-2 text-sm">
          {awards.map((a) => (
            <li key={a.id} className="rounded-full bg-zinc-100 px-3 py-1 dark:bg-zinc-800">
              {AWARD_LABEL[a.id]}: <strong>{playerById(view, a.playerId)?.name ?? '—'}</strong>
            </li>
          ))}
        </ul>
      )}
      {editing && host && (
        <div className="flex w-full flex-col gap-4 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
          <RoomTitle name={view.name} isPublic={view.isPublic} editable />
          <RoomSettingsForm view={view} editable />
        </div>
      )}
      <div className="flex flex-wrap justify-center gap-3">
        {host && (
          <>
            <button
              type="button"
              onClick={() => sendToRoom({ t: 'room:start' })}
              className="rounded-full bg-brand-600 px-6 py-2 font-semibold text-white"
            >
              Play again
            </button>
            <button
              type="button"
              onClick={() => setEditing((e) => !e)}
              className="rounded-full border border-zinc-300 px-6 py-2 dark:border-zinc-700"
            >
              {editing ? 'Hide settings' : 'Change deck & settings'}
            </button>
          </>
        )}
        <a href="/" className="rounded-full border border-zinc-300 px-6 py-2 dark:border-zinc-700">
          Lobby
        </a>
      </div>
      {!host && <p className="text-sm text-zinc-500">The host can start another match.</p>}
    </div>
  );
}
