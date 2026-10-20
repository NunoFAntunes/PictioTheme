import type { Team } from '@pictiotheme/protocol/tower';
import { useEffect, useState } from 'react';
import { myTeam, type RoomView } from '../../../realtime';
import { createPlacementController } from '../placement';
import { CrewFeed } from './CrewFeed';
import { DecideCard } from './DecideCard';
import { DrawingStage, SpyWindow } from './DrawingStage';
import { EventBanner } from './EventBanner';
import { GuessBox } from './GuessBox';
import { ScoreBar } from './ScoreBar';
import { TowerPanel } from './TowerPanel';

/**
 * The match (docs/tower/design/screens.md §3–6): your tower on the left, the other crew's on the
 * right, the drawing in focus in the middle with the guess box, the other drawing in the spy
 * window. While you place a piece, your tower takes the middle.
 */
export function GameScreen({ view }: { view: RoomView }) {
  const team = myTeam(view) ?? 'orange';
  const other: Team = team === 'orange' ? 'teal' : 'orange';
  const [focus, setFocus] = useState<'own' | 'steal'>('own');
  const [controls] = useState(createPlacementController);

  const own = view.crews[team];
  const drawing = own.round?.drawerId === view.you;
  const placing = own.placing?.placerId === view.you;
  const steals = view.settings.steals;
  // The drawer keeps their own board in focus; with steals off there's nothing to swap to.
  const effectiveFocus = drawing || !steals ? 'own' : focus;
  const swap = () => {
    if (!drawing) setFocus((f) => (f === 'own' && steals ? 'steal' : 'own'));
  };
  const focusedTeam = effectiveFocus === 'own' ? team : other;
  const spyTeam = effectiveFocus === 'own' ? other : team;

  useEffect(() => controls.attach(), [controls]);
  useEffect(() => controls.setActive(placing), [controls, placing]);

  // Tab swaps the drawings from anywhere (the guess box handles it itself while focused).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || e.target instanceof HTMLInputElement) return;
      e.preventDefault();
      if (!drawing) setFocus((f) => (f === 'own' && steals ? 'steal' : 'own'));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawing, steals]);

  const myDecision = view.deciding.find((d) => d.solverId === view.you);
  const crewDecision = view.deciding.find(
    (d) => d.solverId !== view.you && view.players.find((p) => p.id === d.solverId)?.team === team,
  );
  const disabledReason = drawing
    ? 'You’re drawing: no guessing'
    : placing
      ? 'Place your piece first'
      : null;

  const stage = (
    <DrawingStage
      key={focusedTeam}
      view={view}
      team={focusedTeam}
      focus={focusedTeam === team ? 'own' : 'steal'}
      onSwap={swap}
      canSwap={!drawing && steals}
    />
  );

  return (
    <div className="flex h-dvh min-h-0 flex-col">
      <ScoreBar view={view} team={team} />
      <main className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1.7fr)_minmax(0,1fr)] gap-3 px-3 pb-3">
        <div className="min-h-0">
          {placing ? (
            <div className="flex h-full flex-col gap-2">
              {stage}
              <CrewFeed view={view} />
            </div>
          ) : (
            <TowerPanel team={team} view={view} controls={controls} placingHere={false} />
          )}
        </div>

        <div className="relative flex min-h-0 flex-col gap-2">
          {placing ? (
            <TowerPanel team={team} view={view} controls={controls} placingHere />
          ) : (
            <>
              {stage}
              {!drawing && (
                <GuessBox
                  view={view}
                  focus={effectiveFocus}
                  onSwap={swap}
                  disabledReason={disabledReason}
                />
              )}
              {crewDecision && <DecideCard view={view} deciding={crewDecision} team={team} />}
            </>
          )}
          <div className="pointer-events-none absolute inset-x-0 top-14 z-20 flex justify-center">
            <EventBanner view={view} team={team} />
          </div>
          {myDecision && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-blueprint-950/40">
              <DecideCard view={view} deciding={myDecision} team={team} />
            </div>
          )}
        </div>

        <div className="flex min-h-0 flex-col gap-3">
          <SpyWindow
            view={view}
            team={spyTeam}
            onSwap={swap}
            stealing={!drawing && steals && spyTeam === other}
          />
          {!placing && !drawing && (
            <div className="flex max-h-48 min-h-24 flex-col">
              <CrewFeed view={view} />
            </div>
          )}
          <div className="min-h-0 flex-1">
            <TowerPanel team={other} view={view} controls={controls} placingHere={false} />
          </div>
        </div>
      </main>
    </div>
  );
}
