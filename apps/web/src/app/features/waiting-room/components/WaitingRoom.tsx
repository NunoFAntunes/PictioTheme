import { useState } from 'react';
import { amHost, sendToRoom, useRoomStore } from '../../../realtime';
import { DeckCover } from '../../deck-cover';
import { ReportDeckButton } from '../../report-deck';
import { RoomSettingsForm } from './RoomSettingsForm';

/** Before a match: share the code, adjust settings, start (user-flows.md §5). */
export function WaitingRoom() {
  const view = useRoomStore((s) => s.view);
  const [copied, setCopied] = useState(false);
  if (!view) return null;
  const host = amHost(view);
  const connected = view.players.filter((p) => p.connected).length;
  const canStart = host && connected >= 2 && view.deck !== null;
  const inviteUrl = `${location.origin}/r/${view.code}`;

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2_000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <section className="flex items-center justify-center gap-6">
        {view.deck && (
          <div data-testid="room-deck" title={view.deck.title} className="relative">
            <DeckCover deck={view.deck} size="compact" />
            <ReportDeckButton deck={view.deck} className="absolute -top-2 -right-2" />
          </div>
        )}
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-sm text-zinc-500">
            {view.isPublic ? '🌍 Public room' : '🔒 Private room'} · share this code
          </p>
          <button
            type="button"
            onClick={() => void copyInvite()}
            className="font-mono text-5xl font-bold tracking-widest"
            title="Copy invite link"
            data-testid="room-code"
          >
            {view.code}
          </button>
          <button
            type="button"
            onClick={() => void copyInvite()}
            className="text-sm text-brand-600 underline"
          >
            {copied ? '✓ Invite link copied' : 'Copy invite link'}
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="mb-2 font-semibold">
          Settings{' '}
          {!host && <span className="text-sm font-normal text-zinc-500">(the host decides)</span>}
        </h2>
        <RoomSettingsForm view={view} editable={host} />
      </section>

      {host ? (
        <div className="flex flex-col items-center gap-1">
          <button
            type="button"
            disabled={!canStart}
            onClick={() => sendToRoom({ t: 'room:start' })}
            className="rounded-full bg-brand-600 px-8 py-3 text-lg font-semibold text-white shadow hover:bg-brand-700 disabled:opacity-50"
          >
            Start game ▶
          </button>
          {connected < 2 && (
            <p className="text-sm text-zinc-500">Waiting for at least one more player…</p>
          )}
        </div>
      ) : (
        <p className="text-center text-zinc-500">Waiting for the host to start…</p>
      )}
    </div>
  );
}
