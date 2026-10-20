import { createStrokeModel } from '@pictiotheme/canvas-engine';
import {
  DEFAULT_SHAPE_CONFIG,
  makePiece,
  type SampleDrawing,
  type ShapeConfig,
  type ShapeResult,
} from '@pictiotheme/doodle-shape';
import type { Stroke } from '@pictiotheme/protocol';
import { DEFAULT_TUNING, type PhysicsTuning } from '@pictiotheme/tower-physics';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { Button } from '../../../ui/Button';
import { Panel } from '../../../ui/Panel';
import {
  DEFAULT_DRAW_SETTINGS,
  DrawingBoard,
  DrawingToolbar,
  type DrawSettings,
} from '../../drawing';
import { PiecePreview, renderPieceBitmap } from '../../piece';
import { attachPlacementKeys } from '../keys';
import { DEFAULT_DAZE, type DazeRules } from '../rules';
import { loadSavedDrawings, storeSavedDrawings, type SavedDrawing } from '../saved-drawings';
import { createSandboxSession, type SandboxSession } from '../session';
import { SANDBOX_WORDS } from '../words';
import { TowerPanel } from './TowerPanel';
import { Workbench } from './Workbench';

function randomWord(not?: string): string {
  for (;;) {
    const word = SANDBOX_WORDS[Math.floor(Math.random() * SANDBOX_WORDS.length)] as string;
    if (word !== not) return word;
  }
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-dusk-900 px-3 py-1 text-right shadow-[0_3px_0_var(--color-dusk-950)]">
      <div className="text-[10px] tracking-widest text-cloud-dim uppercase">{label}</div>
      <div
        className="font-display text-base leading-5 tabular-nums"
        data-testid={`stat-${label.toLowerCase()}`}
      >
        {value}
      </div>
    </div>
  );
}

/**
 * The Phase 0 sandbox (docs/tower/planning/roadmap.md#phase-0-sandbox): draw a word, see the
 * block it makes, build it, place it, and tune everything on the workbench.
 */
export function Sandbox() {
  const [session] = useState<SandboxSession>(() => createSandboxSession());
  const [model] = useState(createStrokeModel);
  const [settings, setSettings] = useState<DrawSettings>(DEFAULT_DRAW_SETTINGS);
  const [word, setWord] = useState(() => randomWord());
  const [shapeConfig, setShapeConfig] = useState<ShapeConfig>(DEFAULT_SHAPE_CONFIG);
  const [physics, setPhysics] = useState<PhysicsTuning>(DEFAULT_TUNING);
  const [line, setLine] = useState(10);
  const [daze, setDaze] = useState<DazeRules>(DEFAULT_DAZE);
  const [showColliders, setShowColliders] = useState(false);
  const [showSilhouette, setShowSilhouette] = useState(true);
  const [workbenchOpen, setWorkbenchOpen] = useState(false);
  const [saved, setSaved] = useState<SavedDrawing[]>(loadSavedDrawings);
  const [shape, setShape] = useState<ShapeResult | null>(null);
  const [strokeCount, setStrokeCount] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const detachKeys = attachPlacementKeys(session);
    return () => {
      detachKeys();
      session.dispose();
    };
  }, [session]);

  const hud = useSyncExternalStore(session.subscribe, session.getHud);

  // The live piece: recomputed a moment after the drawing (or the piece settings) change.
  // Rasterising takes a few ms, so at most about ten times a second.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = (delay: number) => {
      timer ??= setTimeout(() => {
        timer = undefined;
        setShape(makePiece(model.strokes, shapeConfig));
        setStrokeCount(model.strokes.length);
      }, delay);
    };
    schedule(0);
    const unsubscribe = model.subscribe(() => schedule(90));
    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, [model, shapeConfig]);

  // Ctrl/Cmd+Z undoes on the board.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ' && !e.shiftKey) {
        e.preventDefault();
        model.apply({ t: 'draw:undo' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [model]);

  useEffect(() => {
    session.setLine(line);
  }, [session, line]);
  useEffect(() => {
    session.setDaze(daze);
  }, [session, daze]);
  useEffect(() => {
    session.setShowColliders(showColliders);
  }, [session, showColliders]);

  const flash = (text: string) => {
    setNotice(text);
    setTimeout(() => setNotice((n) => (n === text ? null : n)), 2500);
  };

  const queueDrawing = useCallback(
    (drawingWord: string, strokes: readonly Stroke[]) => {
      const result = makePiece(strokes, shapeConfig);
      if (!result.ok) return false;
      session.enqueue({
        word: drawingWord,
        piece: result.piece,
        bitmap: renderPieceBitmap(strokes, result.piece, result.preview),
      });
      return true;
    },
    [session, shapeConfig],
  );

  const build = () => {
    if (!queueDrawing(word, model.strokes)) return;
    model.reset([]);
    setWord(randomWord(word));
  };

  const save = () => {
    const next = [...saved, { word, strokes: model.strokes.map((s) => structuredClone(s)) }];
    setSaved(next);
    flash(storeSavedDrawings(next) ? `Saved “${word}”` : 'Couldn’t save: storage is unavailable');
  };

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify({ word, strokes: model.strokes }));
      flash('Drawing copied as JSON');
    } catch {
      flash('Couldn’t copy to the clipboard');
    }
  };

  const piece = shape?.ok ? shape.piece : null;
  const preview = shape?.preview ?? null;

  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh">
      <header className="flex flex-wrap items-center gap-3 px-4 pt-3 pb-2">
        <a href="/" className="title-outline font-display text-2xl leading-none tracking-wide">
          Doodle <span className="text-sun">Tower</span>
        </a>
        <span className="candy-stripes rounded-lg px-0.5 py-0.5">
          <span className="block rounded-md bg-ink px-2 py-0.5 font-display text-[11px] tracking-widest text-sun">
            SANDBOX
          </span>
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Stat label="Height" value={`${hud.height.toFixed(1)} / ${hud.line} m`} />
          <Stat label="Placed" value={String(hud.placed)} />
          <Stat label="Fumbles" value={String(hud.fumbles)} />
          <Button variant="soft" onClick={() => session.resetTower()}>
            Knock it down
          </Button>
          <Button
            variant="sun"
            onClick={() => setWorkbenchOpen(true)}
            aria-expanded={workbenchOpen}
          >
            Workbench
          </Button>
        </div>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-1 gap-4 px-4 pb-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <div className="flex min-h-0 flex-col gap-3">
          <Panel className="py-3">
            <div className="flex items-center gap-3 px-2">
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold tracking-widest text-ink/60 uppercase">
                  Draw this
                </div>
                <div className="truncate font-display text-2xl leading-tight" data-testid="word">
                  {word}
                </div>
              </div>
              <Button onClick={() => setWord(randomWord(word))}>Skip</Button>
            </div>
          </Panel>

          {/* The board takes whatever height is left, at 4:3 (container query units). */}
          <div
            className="flex min-h-[300px] flex-1 justify-center"
            style={{ containerType: 'size' }}
          >
            <div style={{ width: 'min(100cqw, calc((100cqh - 36px) * 4 / 3 + 24px))' }}>
              <DrawingBoard
                model={model}
                settings={settings}
                preview={preview}
                showSilhouette={showSilhouette}
              />
            </div>
          </div>

          <Panel className="py-3">
            <DrawingToolbar
              settings={settings}
              onChange={setSettings}
              onUndo={() => model.apply({ t: 'draw:undo' })}
              onClear={() => model.apply({ t: 'draw:clear' })}
              canUndo={strokeCount > 0}
            />
          </Panel>

          <Panel
            className="py-3"
            title="Your block"
            actions={
              notice && (
                <span className="text-xs font-semibold text-ink/70" role="status">
                  {notice}
                </span>
              )
            }
          >
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <PiecePreview piece={piece} platformWidth={physics.platformWidth} />
              <div className="flex flex-col gap-2">
                <Button
                  variant="primary"
                  onClick={build}
                  disabled={!piece}
                  className="h-14 px-6 text-lg"
                >
                  Build it
                </Button>
                <div className="flex gap-1.5">
                  <Button onClick={save} disabled={!piece} className="flex-1 text-xs">
                    Save
                  </Button>
                  <Button
                    onClick={() => void copyJson()}
                    disabled={strokeCount === 0}
                    className="flex-1 text-xs"
                  >
                    JSON
                  </Button>
                </div>
              </div>
            </div>
          </Panel>
        </div>

        <div className="min-h-[60vh] lg:min-h-0">
          <TowerPanel session={session} hud={hud} />
        </div>
      </main>

      {workbenchOpen && (
        <Workbench
          onClose={() => setWorkbenchOpen(false)}
          onQueue={(drawings: readonly SampleDrawing[]) => {
            for (const d of drawings) queueDrawing(d.word, d.strokes);
          }}
          onLoad={(d) => {
            model.reset(d.strokes);
            setWord(d.word);
          }}
          saved={saved}
          onDeleteSaved={(i) => {
            const next = saved.filter((_, k) => k !== i);
            setSaved(next);
            storeSavedDrawings(next);
          }}
          shape={shapeConfig}
          onShape={(patch) => setShapeConfig((c) => ({ ...c, ...patch }))}
          physics={physics}
          onPhysics={(patch) => {
            setPhysics((p) => ({ ...p, ...patch }));
            session.retune(patch);
          }}
          line={line}
          onLine={setLine}
          daze={daze}
          onDaze={setDaze}
          showColliders={showColliders}
          onShowColliders={setShowColliders}
          showSilhouette={showSilhouette}
          onShowSilhouette={setShowSilhouette}
        />
      )}
    </div>
  );
}
