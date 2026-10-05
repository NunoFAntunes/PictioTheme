import type { PublicPlayer } from '@pictiotheme/protocol';
import type { ReactNode } from 'react';
import { avatarUrl } from '../../avatar';
import { nameFont, playerHash } from '../name-font';
import { ScoreSticker, type StickerSize } from './ScoreSticker';

/**
 * A player as their own doodle (screens.md §4): the avatar cut out of its background, boiling and
 * swaying a little, with their name handwritten below and their points on a sticker beside it.
 */

const SIZES = {
  lg: { figure: 'size-30', name: 1.3 },
  md: { figure: 'size-22', name: 1.1 },
  sm: { figure: 'size-16', name: 0.9 },
} as const satisfies Record<StickerSize, { figure: string; name: number }>;

export type CharacterSize = StickerSize;

type Props = {
  player: PublicPlayer;
  roomCode: string;
  size: CharacterSize;
  you: boolean;
  drawing: boolean;
  /** Their latest guess, while it is shown. */
  bubble: ReactNode;
  /** Shown during a match. */
  score: { rank: number; gained: number; turnKey: string } | null;
  actions: ReactNode;
};

export function PlayerCharacter({
  player: p,
  roomCode,
  size,
  you,
  drawing,
  bubble,
  score,
  actions,
}: Props) {
  const seed = playerHash(p.id, roomCode);
  const font = nameFont(p.id, roomCode);
  // Out of step with each other, so the room doesn't sway in unison.
  const delay = { animationDelay: `-${(seed % 3600) / 1000}s` };
  const status = drawing
    ? 'drawing'
    : !p.connected
      ? 'away'
      : p.guessedThisTurn
        ? 'guessed!'
        : null;

  return (
    <div className="relative flex flex-col items-center gap-1">
      <div
        className={`relative ${SIZES[size].figure} ${p.connected ? '' : 'opacity-50 grayscale'}`}
      >
        {bubble && (
          <div className="absolute bottom-full left-1/2 z-10 mb-1 w-max max-w-36 -translate-x-1/2 truncate rounded-xl rounded-bl-none border-2 border-ink bg-white px-2 py-0.5 text-xs text-ink shadow-[2px_2px_0_var(--color-ink)]">
            {bubble}
          </div>
        )}
        <div className={`size-full ${p.guessedThisTurn ? 'motion-safe:animate-hop' : ''}`}>
          <div className="size-full motion-safe:animate-sway" style={delay}>
            <div className={`size-full ${drawing ? 'motion-safe:animate-draw-wiggle' : ''}`}>
              <img
                src={avatarUrl(p.avatar)}
                alt={`${p.name}'s avatar`}
                draggable={false}
                className={`size-full object-contain ${p.connected ? 'motion-safe:animate-boil' : ''}`}
                style={delay}
              />
            </div>
          </div>
        </div>
        {p.isHost && (
          <span
            className="absolute -top-3 -left-2 -rotate-20 text-lg"
            title="Host"
            aria-label="Host"
          >
            👑
          </span>
        )}
        {drawing && (
          <span className="absolute -bottom-1 -left-2 text-lg" aria-hidden="true">
            ✏️
          </span>
        )}
        {!p.connected && (
          <span className="absolute -top-2 -right-1 text-base" aria-hidden="true">
            💤
          </span>
        )}
        {p.guessedThisTurn && (
          <span className="absolute top-0 -left-2 rotate-12 text-lg" aria-hidden="true">
            ✅
          </span>
        )}
        {score && (
          <div className="absolute -right-7 -bottom-2">
            <ScoreSticker
              score={p.score}
              rank={score.rank}
              seed={seed}
              size={size}
              gained={score.gained}
              turnKey={score.turnKey}
            />
          </div>
        )}
      </div>
      <p
        className="line-clamp-2 max-w-full text-center leading-tight break-words text-ink [-webkit-text-stroke:0.035em_currentColor]"
        style={{ fontFamily: font.family, fontSize: `${SIZES[size].name * font.scale}rem` }}
      >
        {p.name}
        {you && (
          <span className="font-sans text-[0.65rem] text-zinc-400 [-webkit-text-stroke:0]">
            {' '}
            (you)
          </span>
        )}
        {status && <span className="sr-only">, {status}</span>}
      </p>
      <div className="absolute -top-1 -right-1">{actions}</div>
    </div>
  );
}
