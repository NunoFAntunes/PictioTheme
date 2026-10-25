import type { Piece } from '@pictiotheme/doodle-shape';
import type { Deciding, Team } from '@pictiotheme/protocol/tower';
import { DEFAULT_TUNING } from '@pictiotheme/tower-physics';
import { useEffect, useRef } from 'react';
import { uiScale } from '../../../lib/ui-scale';
import { sendToRoom, useServerNow, type RoomView } from '../../../realtime';
import { CURSE_LABEL, curseNames } from '../../../lib/curses';
import { CREW_NAME } from '../../../ui/CrewBadge';
import { stageAnchor, useStageAnchor } from '../../crew-stage';
import { PiecePreview } from '../../piece';

/**
 * Keep or Curse (game-rules.md#keep-or-curse): once their drawing is guessed, the drawer sees the
 * block and chooses, K or C on a keyboard. If they keep it, they place it; if they curse it, it
 * goes to the other crew with the curse shown on the button. A stolen piece is the thief's to
 * choose. Their crew sees who's deciding. After 5 seconds it's Keep.
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
  const choose = (choice: 'keep' | 'curse') =>
    sendToRoom({ t: 'piece:decide', pieceId: deciding.pieceId, choice });

  // The decider stands on the card's top left corner, bigger on their own card.
  const card = useRef<HTMLDivElement>(null);
  useStageAnchor(stageAnchor.deciding(deciding.deciderId), () => {
    const r = card.current?.getBoundingClientRect();
    if (!r?.width) return null;
    const u = uiScale();
    const size = (mine ? 52 : 34) * u;
    const x = r.left + 10 * u + size / 2;
    return { left: x, right: x, y: r.top + (mine ? 8 : 6) * u, size };
  });

  // The guess box may have focus (the thief's winning guess): let go of it so K and C work.
  useEffect(() => {
    if (mine && document.activeElement instanceof HTMLElement) document.activeElement.blur();
  }, [mine]);

  useEffect(() => {
    if (!mine) return;
    const onKey = (e: KeyboardEvent) => {
      // Not while typing a guess.
      if (e.target instanceof HTMLInputElement || e.ctrlKey || e.metaKey) return;
      if (e.code === 'KeyK') choose('keep');
      if (e.code === 'KeyC') choose('curse');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!piece) return null;
  const { silhouette: _s, cell: _c, ...shape } = piece.shape;
  const seconds = Math.max(0, Math.ceil((deciding.endsAt - now) / 1000));
  const { curses } = piece;

  if (!mine) {
    return (
      <div
        ref={card}
        className="card-panel rounded-2xl px-4 py-2 text-sm font-semibold"
        role="status"
      >
        {decider?.name ?? 'Someone'} is deciding: keep “{piece.word}” or curse it… {seconds}
      </div>
    );
  }
  return (
    <div
      ref={card}
      role="dialog"
      aria-label="Keep or curse"
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
          onClick={() => choose('keep')}
          className="min-h-14 rounded-xl bg-coral font-display text-lg text-cloud shadow-[0_3px_0_var(--color-coral-dark)] active:translate-y-0.5"
        >
          🧱 Keep &amp; place <span className="text-xs opacity-70">(K)</span>
        </button>
        <button
          type="button"
          onClick={() => choose('curse')}
          className="flex min-h-14 flex-col items-center justify-center rounded-xl bg-ink px-2 py-1 font-display text-lg leading-tight text-sun shadow-[0_3px_0_oklch(0.1_0.02_260)] active:translate-y-0.5"
        >
          <span>
            {curses.length ? '🌀 Curse' : '💣 Send'} → {CREW_NAME[other]}{' '}
            <span className="text-xs opacity-70">(C)</span>
          </span>
          {curses.length > 0 && (
            <span className="font-sans text-xs font-semibold text-cloud/85">
              {curseNames(curses)}: {curses.map((c) => CURSE_LABEL[c].effect).join(', ')}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
