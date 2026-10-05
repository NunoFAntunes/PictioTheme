import { useState } from 'react';
import { amHost, sendToRoom, useRoomStore } from '../../../realtime';
import { DeckCover } from '../../deck-cover';
import { DeckChooser } from '../../deck-picker';
import { DrawYourself } from '../../identity';
import { ReportDeckButton } from '../../report-deck';
import { RoomSettingsForm } from './RoomSettingsForm';

/** Before a match: share the code, adjust settings, start (user-flows.md §5). */
export function WaitingRoom() {
  const view = useRoomStore((s) => s.view);
  const [copied, setCopied] = useState(false);
  // The host picks the deck here, with friends watching (user-flows.md §4): open to start with.
  const [choosingDeck, setChoosingDeck] = useState(true);
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
        {!view.deck && <p className="text-sm text-zinc-500">Loading the deck…</p>}
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

      {/* Up top, so the host never scrolls past the deck picker to start. */}
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

      <DrawYourself roomCode={view.code} />

      {host && (
        <section
          aria-labelledby="deck-heading"
          className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 id="deck-heading" className="font-semibold">
              Deck{view.deck && <span className="font-normal">: {view.deck.title}</span>}
            </h2>
            <button
              type="button"
              aria-expanded={choosingDeck}
              onClick={() => setChoosingDeck(!choosingDeck)}
              className="text-sm text-brand-600 underline"
            >
              {choosingDeck ? 'Done' : '🎴 Change deck'}
            </button>
          </div>
          {choosingDeck && (
            <DeckChooser
              selectedId={view.settings.deckId}
              onSelect={(deckId) => sendToRoom({ t: 'room:settings', settings: { deckId } })}
            />
          )}
        </section>
      )}

      <section className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="mb-2 font-semibold">
          Settings{' '}
          {!host && <span className="text-sm font-normal text-zinc-500">(the host decides)</span>}
        </h2>
        <RoomSettingsForm view={view} editable={host} />
      </section>
    </div>
  );
}
