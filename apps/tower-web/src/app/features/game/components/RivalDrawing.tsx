import type { Team } from '@pictiotheme/protocol/tower';
import { strokeModels, useServerNow, type RoomView } from '../../../realtime';
import { CREW_NAME, CREW_TEXT } from '../../../ui/CrewBadge';
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
  return (
    <section
      aria-label={`${CREW_NAME[team]} crew's drawing`}
      data-testid={`rival-${team}`}
      className={`absolute top-2 right-2 z-10 w-[min(42%,15rem)] rounded-2xl border-[3px] bg-dusk-950/90 p-1.5 shadow-xl ${golden ? 'border-sun shadow-[0_0_20px_var(--color-sun)]' : 'border-white'}`}
    >
      <header className="flex items-baseline gap-2 px-1 pb-1">
        <span
          className={`min-w-0 flex-1 truncate font-display text-[11px] tracking-widest ${CREW_TEXT[team]}`}
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
      <div className="overflow-hidden rounded-lg">
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
