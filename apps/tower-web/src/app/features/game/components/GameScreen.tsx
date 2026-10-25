import type { Team } from '@pictiotheme/protocol/tower';
import { DEFAULT_TUNING } from '@pictiotheme/tower-physics';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { myTeam, strokeModels, type RoomView } from '../../../realtime';
import { CrewStage } from '../../crew-stage';
import { DEFAULT_DRAW_SETTINGS, DrawingToolbar, type DrawSettings } from '../../drawing';
import { HowToPlay } from '../../how-to-play';
import { PiecePreview } from '../../piece';
import { TestGuess, TestPanel } from '../../test-mode';
import { createDrawSender } from '../draw-sender';
import { createPlacementController } from '../placement';
import { DecideCard } from './DecideCard';
import { DrawingStage, useBoardWidth, useLivePiece } from './DrawingStage';
import { EventBanner } from './EventBanner';
import { GuessBox } from './GuessBox';
import { PlacingControls } from './PlacingControls';
import { RivalDrawing } from './RivalDrawing';
import { ScoreBar } from './ScoreBar';
import { TowerPanel } from './TowerPanel';

/**
 * A card with two faces that turns over: the drawer's tools on the front, the guess line and the
 * placing controls on the back. Both faces share one cell, so the card is as tall as the taller
 * one and nothing jumps when it flips; the face turned away can't be reached.
 */
function FlipCard({
  flipped,
  front,
  back,
}: {
  flipped: boolean;
  front: ReactNode;
  back: ReactNode;
}) {
  const face = 'card-panel col-start-1 row-start-1 rounded-2xl p-3 backface-hidden';
  return (
    <div className="shrink-0 perspective-[1400px]">
      <div
        className={`grid transition-transform duration-500 transform-3d motion-reduce:transition-none ${flipped ? 'rotate-y-180' : ''}`}
      >
        <div className={face} inert={flipped}>
          {front}
        </div>
        <div className={`${face} rotate-y-180`} inert={!flipped}>
          {back}
        </div>
      </div>
    </div>
  );
}

/**
 * The match (docs/tower/design/screens.md §3–6): the two towers are the show, wide on either
 * side. In the middle, your crew's drawing, and under it the play card: the drawing tools while
 * you draw, turned over to the guess line and the placing controls the rest of the time. The
 * other crew's drawing hangs small in the sky of their tower, to steal.
 */
export function GameScreen({ view }: { view: RoomView }) {
  const team = myTeam(view) ?? 'orange';
  const other: Team = team === 'orange' ? 'teal' : 'orange';
  const [controls] = useState(createPlacementController);
  const [settings, setSettings] = useState<DrawSettings>(DEFAULT_DRAW_SETTINGS);
  const [sender] = useState(() => createDrawSender(team));
  useEffect(() => () => sender.dispose(), [sender]);
  const middle = useRef<HTMLDivElement>(null);
  const boardWidth = useBoardWidth(middle);

  const own = view.crews[team];
  const drawing = own.round?.drawerId === view.you;
  const placing = own.placing?.placerId === view.you;
  const shape = useLivePiece(team, drawing);
  const model = strokeModels[team];
  const subscribe = useCallback((listener: () => void) => model.subscribe(listener), [model]);
  const canUndo = useSyncExternalStore(subscribe, () => model.strokes.length > 0);

  useEffect(() => controls.attach(), [controls]);
  useEffect(() => controls.setActive(placing), [controls, placing]);

  const myDecision = view.deciding.find((d) => d.deciderId === view.you);
  const crewDecision = view.deciding.find(
    (d) =>
      d.deciderId !== view.you && view.players.find((p) => p.id === d.deciderId)?.team === team,
  );
  const testMode = view.settings.testMode === true;
  const disabledReason = drawing
    ? 'You’re drawing: no guessing'
    : placing
      ? 'Place your piece first'
      : null;

  return (
    <div className="flex h-dvh min-h-0 flex-col">
      <ScoreBar view={view} team={team} />
      <HowToPlay variant="round" />
      <main
        className={`grid min-h-0 flex-1 gap-3 px-3 pb-3 ${testMode ? 'grid-cols-[auto_minmax(0,1fr)_clamp(19rem,26vw,26rem)_minmax(0,1fr)]' : 'grid-cols-[minmax(0,1fr)_clamp(19rem,30vw,28rem)_minmax(0,1fr)]'}`}
      >
        {testMode && <TestPanel view={view} team={team} />}
        <TowerPanel team={team} view={view} controls={controls} placingHere={placing} mine />

        <div ref={middle} className="relative flex min-h-0 flex-col gap-3">
          <DrawingStage
            view={view}
            team={team}
            settings={settings}
            shape={shape}
            onOp={(op) => sender.send(op)}
            boardWidth={boardWidth}
            covered={myDecision !== undefined}
          />

          {crewDecision && <DecideCard view={view} deciding={crewDecision} team={team} />}

          <FlipCard
            flipped={!drawing}
            front={
              <div className="flex flex-col gap-2">
                <DrawingToolbar
                  settings={settings}
                  onChange={setSettings}
                  onUndo={() => sender.send({ t: 'draw:undo' })}
                  onClear={() => sender.send({ t: 'draw:clear' })}
                  canUndo={canUndo}
                />
                <PiecePreview
                  piece={shape?.ok ? shape.piece : null}
                  platformWidth={DEFAULT_TUNING.platformWidth}
                />
              </div>
            }
            back={
              <div className="flex h-full flex-col justify-center gap-4">
                {testMode ? (
                  <TestGuess view={view} disabledReason={disabledReason} />
                ) : (
                  <GuessBox view={view} disabledReason={disabledReason} />
                )}
                <PlacingControls controls={controls} placing={placing} />
              </div>
            }
          />

          <div className="pointer-events-none absolute inset-x-0 top-14 z-50 flex justify-center">
            <EventBanner view={view} team={team} />
          </div>
          {myDecision && (
            <div className="absolute inset-0 z-30 flex items-center justify-center rounded-2xl bg-dusk-950/40">
              <DecideCard view={view} deciding={myDecision} team={team} />
            </div>
          )}
        </div>

        <TowerPanel team={other} view={view} placingHere={false}>
          <RivalDrawing view={view} team={other} />
        </TowerPanel>
      </main>
      <CrewStage />
    </div>
  );
}
