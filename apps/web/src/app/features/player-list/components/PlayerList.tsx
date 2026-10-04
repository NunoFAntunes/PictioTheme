import type { PublicPlayer } from '@pictiotheme/protocol';
import { useRef } from 'react';
import {
  amHost,
  drawerIdOf,
  sendToRoom,
  useNow,
  useRoomStore,
  type Bubble,
  type RoomView,
} from '../../../realtime';
import { Avatar } from '../../avatar';
import { rankByScore } from '../leaderboard';
import { useLeaderboardMotion } from '../use-leaderboard-motion';

const BUBBLE_MS = 3_000;
const REDACTED = '██████';

function GuessBubble({ bubble, own }: { bubble: Bubble; own: boolean }) {
  if (bubble.kind === 'correct') return <span className="text-solved">guessed it!</span>;
  if (bubble.kind === 'close') {
    // Close guesses are red and redacted for others; the guesser sees their own text in red.
    return (
      <span className="text-close">
        {own ? bubble.text : REDACTED}
        <span className="sr-only"> (close guess)</span>
      </span>
    );
  }
  return <span className="text-zinc-500">{bubble.text}</span>;
}

function PlayerActions({ player, view }: { player: PublicPlayer; view: RoomView }) {
  if (player.id === view.you) return null;
  const host = amHost(view);
  return (
    <details className="relative">
      <summary
        className="cursor-pointer list-none rounded px-1 text-zinc-400 hover:text-zinc-700"
        aria-label={`Actions for ${player.name}`}
      >
        ⋯
      </summary>
      <div className="absolute right-0 z-10 mt-1 flex w-36 flex-col rounded-lg border border-zinc-200 bg-white py-1 text-sm shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
        {host ? (
          <>
            <button
              type="button"
              className="px-3 py-1 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800"
              onClick={() => sendToRoom({ t: 'room:transferHost', playerId: player.id })}
            >
              Make host
            </button>
            <button
              type="button"
              className="px-3 py-1 text-left text-close hover:bg-zinc-100 dark:hover:bg-zinc-800"
              onClick={() => sendToRoom({ t: 'room:kick', playerId: player.id })}
            >
              Kick
            </button>
          </>
        ) : (
          <button
            type="button"
            className="px-3 py-1 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800"
            onClick={() => sendToRoom({ t: 'vote:kick', playerId: player.id })}
          >
            Vote to kick
          </button>
        )}
      </div>
    </details>
  );
}

/**
 * Players on the left: big drawn avatar, then name, status, latest guess and score (screens.md §4).
 * In a match it is a leaderboard: sorted by score, rows slide when someone overtakes.
 */
export function PlayerList() {
  const view = useRoomStore((s) => s.view);
  const now = useNow(500);
  const list = useRef<HTMLUListElement>(null);
  const inGame = view !== null && view.phase.kind !== 'waiting';
  // A sorted copy: the drawing order is the server's turnOrder and is never derived from this.
  const ranked = view
    ? inGame
      ? rankByScore(view.players)
      : view.players.map((player) => ({ player, rank: 0 }))
    : [];
  useLeaderboardMotion(list, ranked);
  if (!view) return null;
  const drawerId = drawerIdOf(view.phase);

  return (
    <ul ref={list} className="flex flex-col gap-1" aria-label={inGame ? 'Leaderboard' : 'Players'}>
      {ranked.map(({ player: p, rank }) => {
        const bubble = view.bubbles[p.id];
        const showBubble =
          bubble &&
          now - bubble.at < BUBBLE_MS &&
          (view.settings.guessVisibility === 'show' ||
            p.id === view.you ||
            bubble.kind === 'correct');
        return (
          <li
            key={p.id}
            data-player-id={p.id}
            className={`relative flex items-center gap-2.5 rounded-xl p-1.5 ${p.connected ? '' : 'opacity-50'} ${p.guessedThisTurn ? 'bg-solved/15' : ''}`}
          >
            <div className="relative shrink-0">
              <Avatar id={p.avatar} size="lg" alt={`${p.name}'s avatar`} />
              {p.isHost && (
                <span
                  className="absolute -top-2 -left-1.5 text-base drop-shadow"
                  title="Host"
                  aria-label="Host"
                >
                  👑
                </span>
              )}
              {p.id === drawerId && (
                <span
                  className="absolute -right-1.5 -bottom-1.5 rounded-full bg-white px-0.5 text-sm shadow dark:bg-zinc-900"
                  aria-hidden="true"
                >
                  ✏️
                </span>
              )}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <div className="flex items-baseline gap-1 truncate text-xs text-zinc-600 dark:text-zinc-300">
                <span className="truncate font-medium">{p.name}</span>
                {p.id === view.you && <span className="text-zinc-400">(you)</span>}
              </div>
              <div className="truncate text-xs">
                {p.id === drawerId ? (
                  <span>drawing</span>
                ) : !p.connected ? (
                  <span>💤 away</span>
                ) : showBubble ? (
                  <span className="inline-block max-w-full truncate rounded-lg rounded-tl-none bg-zinc-100 px-1.5 py-0.5 dark:bg-zinc-800">
                    <GuessBubble bubble={bubble} own={p.id === view.you} />
                  </span>
                ) : p.guessedThisTurn ? (
                  <span className="text-solved">✅ guessed!</span>
                ) : null}
              </div>
              {inGame && (
                <span className="flex items-baseline gap-1.5 tabular-nums">
                  <span className="text-xs text-zinc-400" aria-label={`Rank ${rank}`}>
                    #{rank}
                  </span>
                  <span className="text-sm font-semibold">{p.score}</span>
                </span>
              )}
            </div>
            <PlayerActions player={p} view={view} />
          </li>
        );
      })}
    </ul>
  );
}
