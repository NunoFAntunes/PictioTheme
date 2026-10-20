import { SAMPLE_DRAWINGS, type SampleDrawing, type ShapeConfig } from '@pictiotheme/doodle-shape';
import type { PhysicsTuning } from '@pictiotheme/tower-physics';
import type { ReactNode } from 'react';
import { Button } from '../../../ui/Button';
import { Slider } from '../../../ui/Slider';
import type { DazeRules } from '../rules';
import type { SavedDrawing } from '../saved-drawings';

export const LINES = [
  { name: 'Short', height: 6 },
  { name: 'Medium', height: 10 },
  { name: 'Tall', height: 15 },
] as const;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 border-t border-ink/15 pt-4 first:border-t-0 first:pt-0">
      <h3 className="font-display text-xs tracking-widest text-ink/70 uppercase">{title}</h3>
      {children}
    </section>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 text-sm font-medium text-ink/80">
      {label}
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-5 cursor-pointer accent-coral"
      />
    </label>
  );
}

/**
 * The sandbox's side drawer: sample and saved drawings to queue, and every tuning value from
 * docs/tower/technical/physics.md#tuning-values-to-find-in-the-sandbox.
 */
export function Workbench({
  onClose,
  onQueue,
  onLoad,
  saved,
  onDeleteSaved,
  shape,
  onShape,
  physics,
  onPhysics,
  line,
  onLine,
  daze,
  onDaze,
  showColliders,
  onShowColliders,
  showSilhouette,
  onShowSilhouette,
}: {
  onClose: () => void;
  onQueue: (drawings: readonly SampleDrawing[]) => void;
  onLoad: (drawing: SampleDrawing) => void;
  saved: readonly SavedDrawing[];
  onDeleteSaved: (index: number) => void;
  shape: ShapeConfig;
  onShape: (patch: Partial<ShapeConfig>) => void;
  physics: PhysicsTuning;
  onPhysics: (patch: Partial<PhysicsTuning>) => void;
  line: number;
  onLine: (height: number) => void;
  daze: DazeRules;
  onDaze: (rules: DazeRules) => void;
  showColliders: boolean;
  onShowColliders: (v: boolean) => void;
  showSilhouette: boolean;
  onShowSilhouette: (v: boolean) => void;
}) {
  const randomSamples = (n: number) =>
    Array.from(
      { length: n },
      () => SAMPLE_DRAWINGS[Math.floor(Math.random() * SAMPLE_DRAWINGS.length)] as SampleDrawing,
    );

  return (
    <aside
      aria-label="Workbench"
      className="card-panel fixed inset-y-0 right-0 z-20 flex w-[min(380px,92vw)] flex-col rounded-l-xl"
    >
      <header className="flex items-center justify-between px-5 pt-4 pb-3">
        <h2 className="font-display text-lg tracking-wide">Workbench</h2>
        <Button onClick={onClose} aria-label="Close the workbench">
          ✕
        </Button>
      </header>
      <div className="flex-1 space-y-5 overflow-y-auto px-5 pb-6">
        <Section title="Samples">
          <div className="flex flex-wrap gap-1.5">
            {SAMPLE_DRAWINGS.map((s) => (
              <Button
                key={s.word}
                onClick={() => onQueue([s])}
                className="font-sans text-xs font-semibold normal-case"
                title={`Queue a ${s.word}`}
              >
                {s.word}
              </Button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="sun" onClick={() => onQueue(randomSamples(5))}>
              Queue 5 random
            </Button>
            <Button variant="sun" onClick={() => onQueue(randomSamples(20))}>
              Queue 20
            </Button>
          </div>
        </Section>

        <Section title="Saved in this browser">
          {saved.length === 0 && (
            <p className="text-sm text-ink/60">Nothing saved yet. Use “Save” under the board.</p>
          )}
          <ul className="space-y-1.5">
            {saved.map((d, i) => (
              <li key={`${d.word}-${i}`} className="flex items-center gap-1.5">
                <span className="flex-1 truncate text-sm font-semibold">{d.word}</span>
                <Button onClick={() => onQueue([d])} className="text-xs">
                  Queue
                </Button>
                <Button onClick={() => onLoad(d)} className="text-xs">
                  Edit
                </Button>
                <Button
                  onClick={() => onDeleteSaved(i)}
                  aria-label={`Delete ${d.word}`}
                  className="text-xs"
                >
                  ✕
                </Button>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Rules">
          <div className="flex gap-1.5" role="radiogroup" aria-label="Height line">
            {LINES.map((l) => (
              <Button
                key={l.name}
                pressed={line === l.height}
                onClick={() => onLine(l.height)}
                className="flex-1"
              >
                {l.name} · {l.height}
              </Button>
            ))}
          </div>
          <Slider
            label="Height line"
            value={line}
            min={3}
            max={30}
            step={1}
            unit=" m"
            onChange={onLine}
          />
          <Slider
            label="Fumble daze"
            value={daze.firstMs / 1000}
            min={0}
            max={10}
            step={1}
            unit=" s"
            onChange={(s) => onDaze({ ...daze, firstMs: s * 1000 })}
          />
        </Section>

        <Section title="Pieces">
          <Slider
            label="Target area"
            value={shape.targetArea}
            min={0.3}
            max={4}
            step={0.05}
            unit=" m²"
            onChange={(v) => onShape({ targetArea: v })}
          />
          <Slider
            label="Max length"
            value={shape.maxLength}
            min={1}
            max={6}
            step={0.1}
            unit=" m"
            onChange={(v) => onShape({ maxLength: v })}
          />
          <Slider
            label="Min thickness"
            value={shape.minThickness}
            min={0.05}
            max={0.6}
            step={0.05}
            unit=" m"
            onChange={(v) => onShape({ minThickness: v })}
          />
          <Slider
            label="Grid resolution"
            value={shape.resolution}
            min={24}
            max={128}
            step={4}
            unit=" cells"
            onChange={(v) => onShape({ resolution: v })}
          />
          <Slider
            label="Max corners"
            value={shape.maxVertices}
            min={8}
            max={96}
            step={1}
            onChange={(v) => onShape({ maxVertices: v })}
          />
          <Slider
            label="Max parts"
            value={shape.maxParts}
            min={1}
            max={24}
            step={1}
            onChange={(v) => onShape({ maxParts: v })}
          />
          <p className="text-xs text-ink/60">Piece settings apply to the next pieces you build.</p>
        </Section>

        <Section title="Physics">
          <Slider
            label="Friction"
            value={physics.friction}
            min={0}
            max={1.5}
            step={0.05}
            onChange={(v) => onPhysics({ friction: v })}
          />
          <Slider
            label="Bounciness"
            value={physics.restitution}
            min={0}
            max={0.8}
            step={0.05}
            onChange={(v) => onPhysics({ restitution: v })}
          />
          <Slider
            label="Gravity"
            value={physics.gravity}
            min={2}
            max={20}
            step={0.1}
            unit=" m/s²"
            onChange={(v) => onPhysics({ gravity: v })}
          />
          <Slider
            label="Lowering speed"
            value={physics.lowerSpeed}
            min={0.2}
            max={3}
            step={0.1}
            unit=" m/s"
            onChange={(v) => onPhysics({ lowerSpeed: v })}
          />
          <Slider
            label="Spin damping"
            value={physics.angularDamping}
            min={0}
            max={3}
            step={0.05}
            onChange={(v) => onPhysics({ angularDamping: v })}
          />
          <Slider
            label="Platform width"
            value={physics.platformWidth}
            min={3}
            max={12}
            step={0.5}
            unit=" m"
            onChange={(v) => onPhysics({ platformWidth: v })}
          />
          <Slider
            label="Platform thickness"
            value={physics.platformThickness}
            min={0.1}
            max={1}
            step={0.05}
            unit=" m"
            onChange={(v) => onPhysics({ platformThickness: v })}
          />
        </Section>

        <Section title="Debug">
          <Toggle label="Show colliders" checked={showColliders} onChange={onShowColliders} />
          <Toggle
            label="Show the piece on the drawing"
            checked={showSilhouette}
            onChange={onShowSilhouette}
          />
        </Section>
      </div>
    </aside>
  );
}
