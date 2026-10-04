import { useEffect, useId, useRef, useState } from 'react';
import { GROUP_PREVIEW, SOUND_GROUPS, type SoundGroup } from '../sound-catalog';
import { playSound } from '../sound-engine';
import { useSoundSettings } from '../sound-settings';

function speakerIcon(muted: boolean, volume: number): string {
  if (muted || volume === 0) return '🔇';
  return volume < 0.5 ? '🔉' : '🔊';
}

function VolumeSlider({
  label,
  value,
  disabled = false,
  onChange,
  onCommit,
}: {
  label: string;
  value: number;
  disabled?: boolean;
  onChange: (volume: number) => void;
  /** Called when the player lets go, to preview the new volume. */
  onCommit?: () => void;
}) {
  return (
    <input
      type="range"
      min={0}
      max={100}
      step={5}
      value={Math.round(value * 100)}
      disabled={disabled}
      aria-label={label}
      aria-valuetext={`${Math.round(value * 100)}%`}
      onChange={(e) => onChange(Number(e.target.value) / 100)}
      onPointerUp={onCommit}
      onKeyUp={onCommit}
      className="h-6 w-full min-w-0 accent-brand-600 disabled:opacity-40"
    />
  );
}

function GroupRow({
  group,
  label,
  description,
}: {
  group: SoundGroup;
  label: string;
  description: string;
}) {
  const setting = useSoundSettings((s) => s.groups[group]);
  const muted = useSoundSettings((s) => s.muted);
  const setGroup = useSoundSettings((s) => s.setGroup);
  const descriptionId = useId();
  const preview = () => playSound(GROUP_PREVIEW[group]);

  return (
    <li className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={setting.on}
            disabled={muted}
            aria-describedby={descriptionId}
            onChange={(e) => {
              setGroup(group, { on: e.target.checked });
              if (e.target.checked) preview();
            }}
            className="size-4 accent-brand-600"
          />
          {label}
        </label>
        <span className="text-xs text-zinc-500 tabular-nums">
          {setting.on ? `${Math.round(setting.volume * 100)}%` : 'Off'}
        </span>
      </div>
      <p id={descriptionId} className="text-xs text-zinc-500">
        {description}
      </p>
      <VolumeSlider
        label={`${label} volume`}
        value={setting.volume}
        disabled={muted || !setting.on}
        onChange={(volume) => setGroup(group, { volume })}
        onCommit={preview}
      />
    </li>
  );
}

/** 🔊 in a header: mute everything, or set the main volume and each group of sounds. */
export function SoundSettingsButton() {
  const [open, setOpen] = useState(false);
  const muted = useSoundSettings((s) => s.muted);
  const master = useSoundSettings((s) => s.master);
  const setMuted = useSoundSettings((s) => s.setMuted);
  const setMaster = useSoundSettings((s) => s.setMaster);
  const ref = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={muted ? 'Sound settings (muted)' : 'Sound settings'}
        onClick={() => setOpen((o) => !o)}
        className="rounded-md px-2 py-1 text-lg leading-none hover:bg-zinc-100 pointer-coarse:min-h-11 pointer-coarse:min-w-11 dark:hover:bg-zinc-800"
      >
        <span aria-hidden="true">{speakerIcon(muted, master)}</span>
      </button>
      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label="Sound settings"
          className="absolute top-full right-0 z-30 mt-2 flex w-72 max-w-[calc(100vw-2rem)] flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-4 text-left shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold">Sound</h2>
              <button
                type="button"
                aria-pressed={muted}
                onClick={() => setMuted(!muted)}
                className={`rounded-md px-2 py-1 text-sm font-medium ${
                  muted ? 'bg-brand-600 text-white' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
              >
                {muted ? '🔇 Muted' : 'Mute all'}
              </button>
            </div>
            <VolumeSlider
              label="Main volume"
              value={master}
              onChange={setMaster}
              onCommit={() => playSound('guessCorrect')}
            />
          </div>
          <ul className="flex flex-col gap-3 border-t border-zinc-200 pt-3 dark:border-zinc-800">
            {SOUND_GROUPS.map((g) => (
              <GroupRow key={g.id} group={g.id} label={g.label} description={g.description} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
