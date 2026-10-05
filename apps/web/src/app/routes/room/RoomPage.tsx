import { normalizeRoomCode } from '@pictiotheme/game-core';
import { useEffect, useState, type ReactNode } from 'react';
import { useParams } from 'react-router';
import { GuessFeed, GuessInput } from '../../features/guess-feed';
import { useEnsureIdentity } from '../../features/identity';
import { PlayerList } from '../../features/player-list';
import { ResultsPanel } from '../../features/results';
import { RoomHeader } from '../../features/room-header';
import { RoomMetrics } from '../../features/metrics';
import { RoomSounds } from '../../features/sound';
import { WaitingRoom } from '../../features/waiting-room';
import type { PlayerIdentity } from '@pictiotheme/protocol';
import { useIdentity } from '../../lib/identity';
import { useMediaQuery } from '../../lib/use-media-query';
import { connectRoom, useRoomStore, type RoomView } from '../../realtime';
import { GameBoard } from './GameBoard';

function CenteredMessage({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-semibold">{title}</h1>
      {children}
      <a href="/" className="text-brand-600 underline">
        Back to the lobby
      </a>
    </main>
  );
}

/**
 * Who to join as, read at each (re)connect. A name or avatar changed in the room ("Draw yourself!")
 * reaches the room through PUT /api/rooms/:code/me instead of a reconnect.
 */
function roomIdentity(): PlayerIdentity {
  const identity = useIdentity.getState().identity;
  if (!identity) throw new Error('No identity yet');
  return { displayName: identity.displayName, avatar: identity.avatar };
}

/** The room screen: players in the sheet's margin, board beside them, feed right (screens.md §4). */
function RoomSession({ code }: { code: string }) {
  const view = useRoomStore((s) => s.view);
  const connection = useRoomStore((s) => s.connection);

  useEffect(() => connectRoom(code, roomIdentity), [code]);

  if (connection.kind === 'closed' && connection.reason !== 'left') {
    return (
      <CenteredMessage title={connection.message}>
        {connection.reason === 'lost' && (
          <button
            type="button"
            onClick={() => location.reload()}
            className="rounded-lg bg-brand-600 px-4 py-2 font-semibold text-white"
          >
            Try again
          </button>
        )}
      </CenteredMessage>
    );
  }
  if (!view) return <CenteredMessage title={`Joining ${code}…`} />;

  return (
    // The page itself never scrolls (no rubber-banding mid-drawing): each area scrolls inside.
    <div className="flex h-dvh flex-col overflow-hidden overscroll-none">
      <RoomSounds />
      <RoomMetrics />
      <RoomHeader />
      <RoomLayout phase={view.phase.kind} />
    </div>
  );
}

/** Wide screens (laptops, tablets in landscape): the sheet (players' margin + board) · guesses. */
const WIDE = '(min-width: 1024px)';

/**
 * One sheet of paper: the players stand in its left margin, right next to the canvas, with nothing
 * but a faint margin line between them. Always light, like the paper on the landing page.
 */
function RoomSheet({ phase, children }: { phase: RoomView['phase']['kind']; children: ReactNode }) {
  const inMatch = phase !== 'waiting' && phase !== 'results';
  return (
    <div
      data-paper
      className="flex min-h-0 overflow-hidden rounded-xl border border-zinc-300 bg-white text-zinc-900 shadow-sm scheme-light dark:border-zinc-700"
    >
      <aside className="relative w-44 shrink-0" aria-label="Players">
        <div className="absolute inset-0 overflow-x-hidden overflow-y-auto pb-4">
          <PlayerList />
        </div>
        <div aria-hidden="true" className="absolute inset-y-0 right-0 w-px bg-pop-tomato/30" />
      </aside>
      <main
        className={`flex min-h-0 min-w-0 flex-1 justify-center overflow-y-auto ${inMatch ? '' : 'p-4'}`}
      >
        {children}
      </main>
    </div>
  );
}

function RoomLayout({ phase }: { phase: RoomView['phase']['kind'] }) {
  const wide = useMediaQuery(WIDE);
  const centre =
    phase === 'waiting' ? (
      <WaitingRoom />
    ) : phase === 'results' ? (
      <ResultsPanel />
    ) : (
      <GameBoard bare={wide} />
    );
  if (wide) {
    return (
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_18rem] gap-3 p-3">
        <RoomSheet phase={phase}>{centre}</RoomSheet>
        <aside className="flex min-h-64 flex-col gap-2 rounded-xl border border-zinc-200 p-2 dark:border-zinc-800">
          <GuessFeed />
          <GuessInput />
        </aside>
      </div>
    );
  }
  // Tablets in portrait (screens.md §4): the board on top, then Players/Guesses tabs, with the
  // guess input always below. During a match nothing scrolls but the tab content.
  const inMatch = phase !== 'waiting' && phase !== 'results';
  return (
    <div className={`flex min-h-0 flex-1 flex-col gap-2 p-2 ${inMatch ? '' : 'overflow-y-auto'}`}>
      <main className="flex shrink-0 justify-center">
        {inMatch ? (
          // Leave the tabs room: the 4:3 board takes at most ~56% of the screen height.
          <div className="w-full max-w-[calc(56dvh*4/3)]">{centre}</div>
        ) : (
          centre
        )}
      </main>
      <RoomTabs grow={inMatch} />
    </div>
  );
}

function RoomTabs({ grow }: { grow: boolean }) {
  const [tab, setTab] = useState<'guesses' | 'players'>('guesses');
  const feedCount = useRoomStore((s) => s.view?.feed.length ?? 0);
  const playerCount = useRoomStore((s) => s.view?.players.length ?? 0);
  // New lines while the players tab is open show as a count on the guesses tab.
  const [seen, setSeen] = useState(feedCount);
  if (tab === 'guesses' && seen !== feedCount) setSeen(feedCount);
  const unread = Math.max(0, feedCount - seen);
  const tabClass = (active: boolean) =>
    `flex-1 rounded-lg px-3 py-2 text-sm font-medium pointer-coarse:py-3 ${
      active ? 'bg-brand-600 text-white' : 'bg-zinc-100 dark:bg-zinc-800'
    }`;
  return (
    <section
      className={`flex flex-col gap-2 rounded-xl border border-zinc-200 p-2 dark:border-zinc-800 ${
        grow ? 'min-h-40 flex-1' : 'h-96 shrink-0'
      }`}
    >
      <div role="tablist" aria-label="Players and guesses" className="flex gap-1">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'guesses'}
          onClick={() => setTab('guesses')}
          className={tabClass(tab === 'guesses')}
        >
          Guesses
          {unread > 0 && (
            <span className="ml-1.5 rounded-full bg-brand-600 px-1.5 text-xs text-white">
              {unread}
            </span>
          )}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'players'}
          onClick={() => setTab('players')}
          className={tabClass(tab === 'players')}
        >
          Players ({playerCount})
        </button>
      </div>
      <div role="tabpanel" className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {tab === 'guesses' ? (
          <GuessFeed />
        ) : (
          <div
            aria-label="Players"
            data-paper
            className="rounded-lg bg-white pb-4 text-zinc-900 scheme-light"
          >
            <PlayerList layout="grid" />
          </div>
        )}
      </div>
      <GuessInput />
    </section>
  );
}

export function RoomPage() {
  const params = useParams();
  // Invite links go straight in: a first-time player gets a silly name (user-flows.md §2).
  const identity = useEnsureIdentity();
  const code = normalizeRoomCode(params.code ?? '');

  if (!code.ok) return <CenteredMessage title="That doesn’t look like a room code." />;
  if (!identity) return <CenteredMessage title={`Joining ${code.code}…`} />;
  return <RoomSession code={code.code} />;
}
