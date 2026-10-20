import type { Piece } from '@pictiotheme/doodle-shape';
import type { Deciding, Team } from '@pictiotheme/protocol/tower';
import { DEFAULT_TUNING } from '@pictiotheme/tower-physics';
import { useEffect } from 'react';
import { sendToRoom, useServerNow, type RoomView } from '../../../realtime';
import { CREW_NAME } from '../../../ui/CrewBadge';
import { PiecePreview } from '../../piece';

/**
 * Build or Send (game-rules.md#build-or-send): once their drawing is guessed, the drawer sees the
 * block and chooses, B or S on a keyboard; if they keep it, they place it. A stolen piece is the
 * thief's to choose. Their crew sees who's deciding. After 5 seconds it's Build.
 */
export function DecideCard({
  view,
  deciding,
  team,
}: {
  view: RoomView;
  deciding: Deciding;
  team: Team;
}) {
  const now = useServerNow(100);
  const piece = view.pieces[deciding.pieceId];
  const mine = deciding.deciderId === view.you;
  const decider = view.players.find((p) => p.id === deciding.deciderId);
  const solver = piece ? view.players.find((p) => p.id === piece.solvedBy) : null;
  const other: Team = team === 'orange' ? 'teal' : 'orange';
  const choose = (choice: 'build' | 'send') =>
    sendToRoom({ t: 'piece:decide', pieceId: deciding.pieceId, choice });

  // The guess box may have focus (the thief's winning guess): let go of it so B and S work.
  useEffect(() => {
    if (mine && document.activeElement instanceof HTMLElement) document.activeElement.blur();
  }, [mine]);

  useEffect(() => {
    if (!mine) return;
    const onKey = (e: KeyboardEvent) => {
      // Not while typing a guess.
      if (e.target instanceof HTMLInputElement || e.ctrlKey || e.metaKey) return;
      if (e.code === 'KeyB') choose('build');
      if (e.code === 'KeyS') choose('send');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!piece) return null;
  const { silhouette: _s, cell: _c, ...shape } = piece.shape;
  const seconds = Math.max(0, Math.ceil((deciding.endsAt - now) / 1000));

  if (!mine) {
    return (
      <div className="card-panel rounded-2xl px-4 py-2 text-sm font-semibold" role="status">
        {decider?.name ?? 'Someone'} is deciding: build with “{piece.word}” or send it… {seconds}
      </div>
    );
  }
  return (
    <div
      role="dialog"
      aria-label="Build or send"
      className="card-panel w-full max-w-md rounded-xl p-4 shadow-2xl"
    >
      <div className="flex items-baseline justify-between px-1">
        <div className="font-display text-xl">
          {piece.stolen ? 'Stolen!' : `${solver?.name ?? 'Your crew'} got it!`} “{piece.word}”
        </div>
        <div className="font-display text-2xl tabular-nums" role="timer">
          {seconds}
        </div>
      </div>
      <div className="my-3">
        <PiecePreview piece={shape satisfies Piece} platformWidth={DEFAULT_TUNING.platformWidth} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => choose('build')}
          className="h-14 rounded-xl bg-coral font-display text-lg text-cloud shadow-[0_3px_0_var(--color-coral-dark)] active:translate-y-0.5"
        >
          🧱 Keep &amp; place <span className="text-xs opacity-70">(B)</span>
        </button>
        <button
          type="button"
          onClick={() => choose('send')}
          className="h-14 rounded-xl bg-ink font-display text-lg text-sun shadow-[0_3px_0_oklch(0.1_0.02_260)] active:translate-y-0.5"
        >
          💣 Send to {CREW_NAME[other]} <span className="text-xs opacity-70">(S)</span>
        </button>
      </div>
    </div>
  );
}
