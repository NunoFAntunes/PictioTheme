import { useState } from 'react';
import { amHost, sendToRoom, useRoomStore, type RoomView } from '../../../realtime';
import { DeckCover } from '../../deck-cover';
import { DeckChooser } from '../../deck-picker';
import { DrawYourself } from '../../identity';
import { ReportDeckButton } from '../../report-deck';
import { WaitingRoomMusic } from '../../sound';
import { PANEL, PANEL_HEADING } from '../../../ui/room-frame';
import { maxMatchMinutes } from '../match-length';
import { RoomSettingsForm } from './RoomSettingsForm';
import { RoomTitle } from './RoomTitle';

/**
 * Before a match (user-flows.md §5, screens.md §3): the room's name on top, then one card with
 * what you'll play, the code to share and Start, then the host's workspace: the deck library
 * (most of the width, scrolling inside) beside the house rules. Players see the rules read-only.
 */
export function WaitingRoom() {
  const view = useRoomStore((s) => s.view);
  if (!view) return null;
  const host = amHost(view);

  return (
    <div className="@container mx-auto flex w-full max-w-6xl flex-col gap-5">
      <WaitingRoomMusic />
      <RoomTitle name={view.name} editable={host} />
      <ReadyCard view={view} host={host} />
      <DrawYourself roomCode={view.code} startFolded={host} />

      {host ? (
        <div className="grid gap-4 @[46rem]:grid-cols-[minmax(0,1fr)_21rem] @[46rem]:items-start">
          <DeckChooser
            className="h-[min(42rem,80dvh)]"
            selectedId={view.settings.deckId}
            onSelect={(deckId) => sendToRoom({ t: 'room:settings', settings: { deckId } })}
          />
          <RulesPanel view={view} editable />
        </div>
      ) : (
        <div className="mx-auto w-full max-w-3xl">
          <RulesPanel view={view} editable={false} />
        </div>
      )}
    </div>
  );
}

function RulesPanel({ view, editable }: { view: RoomView; editable: boolean }) {
  return (
    <section aria-labelledby="rules-heading" className={PANEL}>
      <h2 id="rules-heading" className={`mb-3 ${PANEL_HEADING}`}>
        📜 House rules{' '}
        {!editable && <span className="font-sans text-sm text-zinc-500">(the host decides)</span>}
      </h2>
      <RoomSettingsForm view={view} editable={editable} />
    </section>
  );
}

/** "3 rounds · 80s · Easy, Medium · 🤪": the rules at a glance, beside the deck. */
function rulesSummary(view: RoomView): string {
  const s = view.settings;
  const players = view.players.filter((p) => p.connected).length;
  const difficulties = s.difficulties.map((d) => d[0]?.toUpperCase() + d.slice(1)).join(', ');
  return [
    `${s.rounds} round${s.rounds === 1 ? '' : 's'}`,
    `${s.drawSeconds}s to draw`,
    difficulties,
    ...(s.silly.enabled ? ['🤪 Silly'] : []),
    `up to ~${maxMatchMinutes(s, players)} min`,
  ].join(' · ');
}

/** What you'll play, the code to share, and Start: everything needed to begin, in one card. */
function ReadyCard({ view, host }: { view: RoomView; host: boolean }) {
  const [copied, setCopied] = useState(false);
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
    <section
      aria-label="Ready to play"
      className="grid grid-cols-2 items-center gap-4 rounded-2xl border-2 border-ink bg-paper p-4 shadow-[4px_4px_0_var(--color-ink)] @2xl:grid-cols-[minmax(0,1fr)_auto_auto] @2xl:gap-6 dark:border-zinc-600 dark:bg-zinc-900 dark:shadow-none"
    >
      <div className="col-span-2 flex min-w-0 items-center gap-3 @2xl:col-span-1">
        {view.deck ? (
          <div data-testid="room-deck" title={view.deck.title} className="relative shrink-0">
            <DeckCover deck={view.deck} size="compact" />
            <ReportDeckButton deck={view.deck} className="absolute -top-2 -right-2" />
          </div>
        ) : (
          <p className="text-sm text-zinc-500">Loading the deck…</p>
        )}
        {view.deck && (
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
              Playing with
            </p>
            <p className="truncate text-lg leading-tight font-semibold">{view.deck.title}</p>
            <p className="mt-0.5 text-xs text-zinc-500">{rulesSummary(view)}</p>
          </div>
        )}
      </div>

      <div className="flex flex-col items-center gap-0.5 text-center @2xl:border-x @2xl:border-dashed @2xl:border-zinc-300 @2xl:px-6 dark:@2xl:border-zinc-700">
        <p className="text-xs text-zinc-500">
          {view.isPublic ? '🌍 Public room' : '🔒 Private room'} · share this code
        </p>
        <button
          type="button"
          onClick={() => void copyInvite()}
          className="font-mono text-3xl font-bold tracking-widest"
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
          {copied ? '✓ Invite link copied' : '📋 Copy invite link'}
        </button>
      </div>

      <div className="flex flex-col items-center gap-1 text-center">
        {host ? (
          <>
            <button
              type="button"
              disabled={!canStart}
              onClick={() => sendToRoom({ t: 'room:start' })}
              className="rounded-full border-2 border-ink bg-brand-600 px-7 py-2.5 text-lg font-semibold text-white shadow-[3px_3px_0_var(--color-ink)] transition hover:-translate-y-0.5 hover:bg-brand-700 active:translate-y-0 active:shadow-none disabled:translate-y-0 disabled:border-transparent disabled:opacity-50 disabled:shadow-none"
            >
              Start game ▶
            </button>
            <p className="text-xs text-zinc-500">
              {connected < 2
                ? 'Waiting for at least one more player…'
                : `${connected} players here`}
            </p>
          </>
        ) : (
          <p className="text-sm text-zinc-500">
            Waiting for the host to start
            <span className="motion-safe:animate-pulse">…</span>
          </p>
        )}
      </div>
    </section>
  );
}
