import { makePiece, type ShapeResult } from '@pictiotheme/doodle-shape';
import type { Team } from '@pictiotheme/protocol/tower';
import { DEFAULT_TUNING } from '@pictiotheme/tower-physics';
import { useEffect, useState } from 'react';
import { strokeModels, useServerNow, type RoomView } from '../../../realtime';
import { Button } from '../../../ui/Button';
import { CREW_NAME, CREW_TEXT } from '../../../ui/CrewBadge';
import {
  DEFAULT_DRAW_SETTINGS,
  DrawingBoard,
  DrawingToolbar,
  type DrawSettings,
} from '../../drawing';
import { PiecePreview } from '../../piece';
import { createDrawSender } from '../draw-sender';

/** The drawer's live block: recomputed a moment after the drawing changes. */
function useLivePiece(team: Team, enabled: boolean): ShapeResult | null {
  const [shape, setShape] = useState<ShapeResult | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const model = strokeModels[team];
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = (delay: number) => {
      timer ??= setTimeout(() => {
        timer = undefined;
        setShape(makePiece(model.strokes));
      }, delay);
    };
    schedule(0);
    const unsubscribe = model.subscribe(() => schedule(120));
    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, [team, enabled]);
  return enabled ? shape : null;
}

/**
 * A crew's drawing, large: for the drawer, their board with the word, the tools and the block
 * it'll make; for everyone else, the drawing with the letter mask (your crew) and the time left.
 */
export function DrawingStage({
  view,
  team,
  focus,
  onSwap,
  canSwap,
}: {
  view: RoomView;
  /** The crew whose drawing this is. */
  team: Team;
  focus: 'own' | 'steal';
  onSwap: () => void;
  canSwap: boolean;
}) {
  const now = useServerNow();
  const round = view.crews[team].round;
  const drawing = round?.drawerId === view.you;
  const [settings, setSettings] = useState<DrawSettings>(DEFAULT_DRAW_SETTINGS);
  const [sender] = useState(() => createDrawSender(team));
  useEffect(() => () => sender.dispose(), [sender]);
  const shape = useLivePiece(team, drawing);
  const drawer = round ? view.players.find((p) => p.id === round.drawerId) : null;
  const secondsLeft = round ? Math.max(0, Math.ceil((round.endsAt - now) / 1000)) : 0;
  const model = strokeModels[team];

  return (
    <section
      aria-label={`${CREW_NAME[team]} crew's drawing`}
      className="flex min-h-0 flex-col gap-2"
      data-testid={`stage-${team}`}
    >
      <header className="flex items-end gap-3 px-1">
        <div className="min-w-0 flex-1">
          <div className={`font-display text-xs tracking-widest ${CREW_TEXT[team]}`}>
            {focus === 'steal'
              ? `🦝 STEALING FROM ${CREW_NAME[team].toUpperCase()}`
              : `${CREW_NAME[team].toUpperCase()} CREW`}
            {drawer && !drawing && (
              <span className="ml-2 text-chalk-dim normal-case">{drawer.name} is drawing</span>
            )}
          </div>
          <div
            className="truncate font-display text-3xl leading-tight tracking-[0.15em]"
            data-testid={drawing ? 'word' : 'mask'}
          >
            {round ? (drawing ? round.word : (round.mask ?? '?')) : 'Next drawing…'}
          </div>
        </div>
        {round && (
          <div
            className={`font-display text-3xl tabular-nums ${secondsLeft <= 10 ? 'text-hazard' : ''}`}
            role="timer"
          >
            {secondsLeft}
          </div>
        )}
        {canSwap && (
          <Button onClick={onSwap} title="Swap drawings (Tab)" className="text-xs">
            ⇄ Tab
          </Button>
        )}
      </header>

      <DrawingBoard
        model={model}
        settings={settings}
        preview={shape?.preview ?? null}
        showSilhouette={drawing}
        disabled={!drawing}
        onOp={(op) => sender.send(op)}
        label={drawing ? 'Your drawing' : `${CREW_NAME[team]} crew's drawing`}
      />

      {drawing && (
        <div className="plywood flex flex-wrap items-center gap-3 rounded-lg p-2">
          <div className="min-w-0 flex-1">
            <DrawingToolbar
              settings={settings}
              onChange={setSettings}
              onUndo={() => sender.send({ t: 'draw:undo' })}
              onClear={() => sender.send({ t: 'draw:clear' })}
              canUndo={model.strokes.length > 0}
            />
          </div>
          <div className="w-56">
            <PiecePreview
              piece={shape?.ok ? shape.piece : null}
              platformWidth={DEFAULT_TUNING.platformWidth}
            />
          </div>
        </div>
      )}
    </section>
  );
}

/** The other drawing, small: watch it, or swap it into focus to steal it. */
export function SpyWindow({
  view,
  team,
  onSwap,
  stealing,
}: {
  view: RoomView;
  team: Team;
  onSwap: () => void;
  /** Steals are on and you may guess at it. */
  stealing: boolean;
}) {
  const round = view.crews[team].round;
  const label = stealing ? `Spy on ${CREW_NAME[team]}` : `${CREW_NAME[team]} crew's drawing`;
  return (
    <button
      type="button"
      onClick={onSwap}
      onMouseUp={(e) => e.currentTarget.blur()}
      aria-label={stealing ? `${label}: swap it into focus to steal it` : label}
      className="group block w-full overflow-hidden rounded-lg border-2 border-blueprint-700 bg-blueprint-950/60 text-left hover:border-hazard"
    >
      <div className="flex items-center justify-between px-2 py-1">
        <span className={`font-display text-xs tracking-wide ${CREW_TEXT[team]}`}>{label}</span>
        <span className="text-xs text-chalk-dim group-hover:text-hazard">
          {round ? (stealing ? 'Tab to steal 🦝' : 'Tab to look') : 'next drawing…'}
        </span>
      </div>
      <div className="pointer-events-none">
        <DrawingBoard
          model={strokeModels[team]}
          settings={DEFAULT_DRAW_SETTINGS}
          disabled
          plain
          label={`${CREW_NAME[team]} crew's drawing, small`}
        />
      </div>
    </button>
  );
}
