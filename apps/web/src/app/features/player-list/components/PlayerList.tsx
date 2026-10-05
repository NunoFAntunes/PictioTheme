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
import { rankByScore } from '../leaderboard';
import { useLeaderboardMotion } from '../use-leaderboard-motion';
import { BoilFilters } from './BoilFilters';
import { PlayerCharacter, type CharacterSize } from './PlayerCharacter';

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
  return <span>{bubble.text}</span>;
}

function PlayerActions({ player, view }: { player: PublicPlayer; view: RoomView }) {
  if (player.id === view.you) return null;
  const host = amHost(view);
  return (
    <details className="relative">
      <summary
        className="cursor-pointer list-none rounded px-1 text-zinc-400 hover:text-zinc-700 pointer-coarse:px-2"
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

/** Characters shrink as the room fills up, so more fit in the margin before it scrolls. */
function sizeFor(count: number): CharacterSize {
  return count <= 6 ? 'lg' : count <= 10 ? 'md' : 'sm';
}

/**
 * The players, each drawn as their own doodle (screens.md §4): a column in the sheet's left margin,
 * or a wrapping grid in the tablet's Players tab. In a match it is a leaderboard: sorted by score,
 * with characters sliding past each other when someone overtakes.
 */
export function PlayerList({ layout = 'column' }: { layout?: 'column' | 'grid' }) {
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
  const size = sizeFor(view.players.length);
  const reveal = view.phase.kind === 'reveal' ? view.phase : null;

  return (
    <>
      <BoilFilters />
      <ul
        ref={list}
        className={
          layout === 'column'
            ? 'flex flex-col items-center gap-8 pt-9'
            : 'flex flex-wrap justify-center gap-x-8 gap-y-6 pt-9'
        }
        aria-label={inGame ? 'Leaderboard' : 'Players'}
      >
        {ranked.map(({ player: p, rank }) => {
          const bubble = view.bubbles[p.id];
          const showBubble =
            bubble &&
            now - bubble.at < BUBBLE_MS &&
            (view.settings.guessVisibility === 'show' ||
              p.id === view.you ||
              bubble.kind === 'correct');
          return (
            <li key={p.id} data-player-id={p.id} className="w-full max-w-36 px-6">
              <PlayerCharacter
                player={p}
                roomCode={view.code}
                size={size}
                you={p.id === view.you}
                drawing={p.id === drawerId}
                bubble={showBubble ? <GuessBubble bubble={bubble} own={p.id === view.you} /> : null}
                score={
                  inGame
                    ? {
                        rank,
                        gained: reveal?.deltas[p.id] ?? 0,
                        turnKey: reveal ? String(reveal.endsAt) : '',
                      }
                    : null
                }
                actions={<PlayerActions player={p} view={view} />}
              />
            </li>
          );
        })}
      </ul>
    </>
  );
}
