import { RoomName } from '@pictiotheme/protocol';
import { useRef, useState, type CSSProperties } from 'react';
import { sendToRoom } from '../../../realtime';

/**
 * The room's name at the top of the waiting room, as sticker letters like the logo's: they pop on
 * one by one, again after every rename, and hop when you point at them. The host renames the
 * room in place (click the name or ✏️); Enter or leaving the field saves, Escape cancels.
 */

const POPS = [
  'var(--color-pop-purple)',
  'var(--color-pop-tomato)',
  'var(--color-pop-sun)',
  'var(--color-pop-teal)',
  'var(--color-pop-pink)',
];

/**
 * As big as fits the name on one line of the waiting room (a size container), up to 4rem. A
 * sticker letter is about half an em wide; below 1.75rem long names wrap instead.
 */
function sizeFor(name: string): CSSProperties {
  const length = Math.max(8, [...name].length);
  return { fontSize: `clamp(1.75rem, ${(170 / length).toFixed(2)}cqi, 4rem)` };
}

function StickerLetters({ name }: { name: string }) {
  let index = 0;
  return (
    <span aria-hidden="true" className="flex flex-wrap justify-center gap-x-[0.3em]">
      {name.split(/\s+/).map((word, w) => (
        <span key={w} className="inline-flex flex-wrap justify-center">
          {[...word].map((char) => {
            const i = index++;
            return (
              <span
                key={i}
                className="inline-block motion-safe:animate-sticker-pop"
                style={
                  {
                    animationDelay: `${i * 45}ms`,
                    '--drop-spin': `${(i % 2 ? 1 : -1) * (20 + ((i * 37) % 40))}deg`,
                  } as CSSProperties
                }
              >
                <span
                  className="inline-block px-[0.01em] transition-transform duration-150 [paint-order:stroke_fill] [text-shadow:0.05em_0.06em_0_var(--color-ink)] [-webkit-text-stroke:0.07em_var(--color-ink)] motion-safe:hover:-translate-y-[0.12em] motion-safe:hover:rotate-[var(--tilt)]"
                  style={
                    {
                      color: POPS[i % POPS.length],
                      '--tilt': `${i % 2 ? 8 : -8}deg`,
                    } as CSSProperties
                  }
                >
                  {char}
                </span>
              </span>
            );
          })}
        </span>
      ))}
    </span>
  );
}

/** A scribbled underline, drawn once the letters have landed. */
function Squiggle({ delayMs }: { delayMs: number }) {
  return (
    <svg
      viewBox="0 0 300 24"
      preserveAspectRatio="none"
      aria-hidden="true"
      className="mx-auto -mt-1 h-3 w-[min(80%,18rem)] overflow-visible"
    >
      <path
        d="M4 14c30-10 52-10 74 0s44 10 72 0 50-10 74 0 46 8 72-2"
        pathLength={1}
        fill="none"
        stroke="var(--color-pop-purple)"
        strokeWidth="5"
        strokeLinecap="round"
        className="[stroke-dasharray:1] motion-safe:animate-squiggle-draw"
        style={{ animationDelay: `${delayMs}ms` }}
      />
    </svg>
  );
}

function RenameField({ name, onDone }: { name: string; onDone: () => void }) {
  const [value, setValue] = useState(name);
  // Escape closes the field, and the blur that may follow must not save it.
  const cancelled = useRef(false);

  function save() {
    if (cancelled.current) return;
    const parsed = RoomName.safeParse(value);
    if (parsed.success && parsed.data !== name) {
      sendToRoom({ t: 'room:details', name: parsed.data });
    }
    onDone();
  }

  return (
    <input
      aria-label="Room name"
      autoFocus
      value={value}
      maxLength={40}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => setValue(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') {
          cancelled.current = true;
          onDone();
        }
      }}
      style={sizeFor(value)}
      className="w-full max-w-3xl rounded-xl border-2 border-dashed border-ink/40 bg-transparent px-3 py-1 text-center font-logo text-ink outline-none focus:border-pop-purple dark:border-zinc-500 dark:text-zinc-100"
    />
  );
}

export function RoomTitle({ name, editable }: { name: string; editable: boolean }) {
  const [editing, setEditing] = useState(false);
  const letters = [...name.replace(/\s+/g, '')].length;

  if (editing) {
    return (
      <div className="@container flex w-full flex-col items-center gap-1">
        <RenameField name={name} onDone={() => setEditing(false)} />
        <p className="text-xs text-zinc-500">Enter to save · Esc to cancel</p>
      </div>
    );
  }

  return (
    <div className="@container flex w-full flex-col items-center">
      <div className="flex items-center justify-center gap-2">
        <h1 className="font-logo leading-tight font-normal text-ink" style={sizeFor(name)}>
          <span className="sr-only">{name}</span>
          {/* Keyed by the name, so the letters pop on again after a rename. */}
          {editable ? (
            // A shortcut for the pointer: keyboards and screen readers get the ✏️ button.
            <button
              key={name}
              type="button"
              tabIndex={-1}
              aria-hidden="true"
              onClick={() => setEditing(true)}
              title="Rename the room"
              className="cursor-text rounded-xl"
            >
              <StickerLetters name={name} />
            </button>
          ) : (
            <StickerLetters key={name} name={name} />
          )}
        </h1>
        {editable && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label="Rename the room"
            title="Rename the room"
            className="shrink-0 rotate-6 rounded-full border-2 border-ink bg-white px-2 py-1 text-sm shadow-[2px_2px_0_var(--color-ink)] transition hover:rotate-0"
          >
            ✏️
          </button>
        )}
      </div>
      <Squiggle key={name} delayMs={letters * 45 + 250} />
    </div>
  );
}
