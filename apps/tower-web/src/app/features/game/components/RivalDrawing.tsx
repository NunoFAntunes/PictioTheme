import type { Team } from '@pictiotheme/protocol/tower';
import { useRef } from 'react';
import { uiScale } from '../../../lib/ui-scale';
import { strokeModels, useServerNow, type RoomView } from '../../../realtime';
import { CREW_NAME, CREW_TEXT } from '../../../ui/CrewBadge';
import { stageAnchor, useStageAnchor } from '../../crew-stage';
import { DEFAULT_DRAW_SETTINGS, DrawingBoard } from '../../drawing';

/**
 * The other crew's drawing, small, up in the sky of their tower: there to steal (with no hints),
 * or just to watch when steals are off. You guess it in the same guess line.
 */
export function RivalDrawing({ view, team }: { view: RoomView; team: Team }) {
  const now = useServerNow();
  const round = view.crews[team].round;
  const drawer = round ? view.players.find((p) => p.id === round.drawerId) : null;
  const secondsLeft = round ? Math.max(0, Math.ceil((round.endsAt - now) / 1000)) : 0;
  const golden = round?.golden ?? false;
  // Their crew on stage, small: the guessers along the card's top edge, the drawer in a corner.
  const card = useRef<HTMLElement>(null);
  const board = useRef<HTMLDivElement>(null);
  useStageAnchor(stageAnchor.rim(team), () => {
    const r = card.current?.getBoundingClientRect();
    const u = uiScale();
    return r?.width
      ? { left: r.left + 12 * u, right: r.right - 12 * u, y: r.top + 5 * u, size: 26 * u }
      : null;
  });
  useStageAnchor(stageAnchor.board(team), () => {
    const r = board.current?.getBoundingClientRect();
    if (!r?.width) return null;
    const x = (r.left + r.right) / 2;
    return { left: x, right: x, y: (r.top + r.bottom) / 2, size: 30 * uiScale() };
  });
  useStageAnchor(stageAnchor.pad(team), () => {
    const r = board.current?.getBoundingClientRect();
    if (!r?.width) return null;
    const u = uiScale();
    const size = 28 * u;
    const x = r.right - 4 * u - size / 2;
    return { left: x, right: x, y: r.bottom - 2 * u, size };
  });
  return (
    <section
      ref={card}
      aria-label={`${CREW_NAME[team]} crew's drawing`}
      data-testid={`rival-${team}`}
      className={`absolute top-6 right-2 z-10 w-[min(42%,15rem)] rounded-2xl border-[3px] bg-dusk-950/90 p-1.5 shadow-xl ${golden ? 'border-sun shadow-[0_0_20px_var(--color-sun)]' : 'border-white'}`}
    >
      <header className="flex items-baseline gap-2 px-1 pb-1">
        <span
          className={`min-w-0 flex-1 truncate font-display text-[0.6875rem] tracking-widest ${CREW_TEXT[team]}`}
        >
          {view.settings.steals ? '🦝 STEAL IT' : `${CREW_NAME[team].toUpperCase()} CREW`}
          {golden && <span className="ml-1.5 text-sun">✨ GOLDEN</span>}
          {drawer && <span className="ml-1.5 text-cloud-dim normal-case">{drawer.name}</span>}
        </span>
        {round && (
          <span
            className={`font-display text-sm tabular-nums ${secondsLeft <= 10 ? 'text-sun' : ''}`}
          >
            {secondsLeft}
          </span>
        )}
      </header>
      <div ref={board} className="overflow-hidden rounded-lg">
        <DrawingBoard
          model={strokeModels[team]}
          settings={DEFAULT_DRAW_SETTINGS}
          disabled
          plain
          label={`${CREW_NAME[team]} crew's drawing`}
        />
      </div>
    </section>
  );
}
