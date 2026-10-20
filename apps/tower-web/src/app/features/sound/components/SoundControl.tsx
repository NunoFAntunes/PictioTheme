import { useEffect, useId, useRef, useState } from 'react';
import { SpeakerIcon } from '../../../ui/icons';
import { useSoundSettings } from '../sound-settings';

function Volume({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const id = useId();
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1">
      <label htmlFor={id} className="text-sm font-semibold text-ink/80">
        {label}
      </label>
      <output htmlFor={id} className="font-display text-xs tabular-nums text-ink">
        {Math.round(value * 100)}%
      </output>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        step={5}
        value={Math.round(value * 100)}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        className="col-span-2 h-2 w-full cursor-pointer accent-coral"
      />
    </div>
  );
}

/**
 * The sound control, top right on every page: the speaker opens a little card with the mute and
 * the music and effects volumes (remembered in this browser). Under drawers and overlays (the
 * sandbox's workbench covers it while open).
 */
export function SoundControl() {
  const { muted, music, effects, toggle, setMusic, setEffects } = useSoundSettings();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const silent = muted || (music === 0 && effects === 0);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', onPointer);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="fixed top-2 right-3 z-10">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        // Space places pieces: a focused button would "click" too.
        onMouseUp={(e) => e.currentTarget.blur()}
        aria-label="Sound"
        aria-expanded={open}
        title="Sound"
        className="flex h-10 w-10 items-center justify-center rounded-xl bg-dusk-900 text-cloud shadow-[0_3px_0_var(--color-dusk-950)] transition hover:bg-dusk-800"
      >
        <SpeakerIcon muted={silent} />
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Sound"
          className="card-panel absolute top-12 right-0 w-60 space-y-3 rounded-2xl p-4"
        >
          <button
            type="button"
            onClick={toggle}
            aria-pressed={muted}
            className="flex w-full items-center justify-between rounded-xl bg-card-dark px-3 py-2 font-display text-sm text-ink transition hover:bg-card-edge/50"
          >
            {muted ? 'Sound is off' : 'Sound is on'}
            <span
              className={`relative h-5 w-9 rounded-full transition ${muted ? 'bg-pebble' : 'bg-grass-dark'}`}
              aria-hidden="true"
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${muted ? 'left-0.5' : 'left-[1.125rem]'}`}
              />
            </span>
          </button>
          <Volume label="Music" value={music} onChange={setMusic} />
          <Volume label="Effects" value={effects} onChange={setEffects} />
        </div>
      )}
    </div>
  );
}
