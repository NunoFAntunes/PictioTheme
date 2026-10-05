import { RoomName } from '@pictiotheme/protocol';
import { useRef, useState, type CSSProperties } from 'react';
import { sendToRoom } from '../../../realtime';
import { PrivacyToggle } from './PrivacyToggle';

/**
 * The room's name, as sticker letters like the logo's: they pop on one by one, again after every
 * rename, and hop when you point at them. The host renames the room in place (click the name or
 * ✏️); Enter or leaving the field saves, Escape cancels. Beside it, whether the room is public.
 * On the waiting room's card (RoomCard) it's left-aligned; on results, centred.
 */

type Align = 'start' | 'center';

const POPS = [
  'var(--color-pop-purple)',
  'var(--color-pop-tomato)',
  'var(--color-pop-sun)',
  'var(--color-pop-teal)',
  'var(--color-pop-pink)',
];

/**
 * As big as fits the name on one line of its container (a size container), up to `max`. A
 * sticker letter is about half an em wide; below 1.75rem long names wrap instead.
 */
function sizeFor(name: string, max: string, share = 170): CSSProperties {
  const length = Math.max(8, [...name].length);
  return { fontSize: `clamp(1.75rem, ${(share / length).toFixed(2)}cqi, ${max})` };
}

function StickerLetters({ name, align }: { name: string; align: Align }) {
  const justify = align === 'start' ? 'justify-start' : 'justify-center';
  let index = 0;
  return (
    <span aria-hidden="true" className={`flex flex-wrap gap-x-[0.3em] ${justify}`}>
      {name.split(/\s+/).map((word, w) => (
        <span key={w} className={`inline-flex flex-wrap ${justify}`}>
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
function Squiggle({ delayMs, align }: { delayMs: number; align: Align }) {
  return (
    <svg
      viewBox="0 0 300 24"
      preserveAspectRatio="none"
      aria-hidden="true"
      className={`-mt-1 h-3 w-[min(80%,18rem)] overflow-visible ${align === 'center' ? 'mx-auto' : ''}`}
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

function RenameField({ name, max, onDone }: { name: string; max: string; onDone: () => void }) {
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
      style={sizeFor(value, max)}
      className="w-full max-w-3xl rounded-xl border-2 border-dashed border-ink/40 bg-transparent px-3 py-1 text-center font-logo text-ink outline-none focus:border-pop-purple dark:border-zinc-500 dark:text-zinc-100"
    />
  );
}

export function RoomTitle({
  name,
  isPublic,
  editable,
  align = 'center',
}: {
  name: string;
  isPublic: boolean;
  editable: boolean;
  align?: Align;
}) {
  const [editing, setEditing] = useState(false);
  const letters = [...name.replace(/\s+/g, '')].length;
  // On the card the name shares its line with the privacy switch, so it stays smaller.
  const max = align === 'start' ? '3.25rem' : '4rem';
  const items = align === 'start' ? 'items-start' : 'items-center';

  if (editing) {
    return (
      <div className={`@container flex w-full flex-col gap-1 ${items}`}>
        <RenameField name={name} max={max} onDone={() => setEditing(false)} />
        <p className="text-xs text-zinc-500">Enter to save · Esc to cancel</p>
      </div>
    );
  }

  return (
    <div
      className={`@container flex w-full flex-wrap items-center gap-x-5 gap-y-2 ${align === 'start' ? 'justify-between' : 'justify-center'}`}
    >
      <div className={`flex min-w-0 flex-col ${items}`}>
        <div className="flex min-w-0 items-center gap-2">
          <h1
            className="min-w-0 font-logo leading-tight font-normal text-ink"
            style={sizeFor(name, max, align === 'start' ? 95 : 170)}
          >
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
                className="cursor-text rounded-xl text-left"
              >
                <StickerLetters name={name} align={align} />
              </button>
            ) : (
              <StickerLetters key={name} name={name} align={align} />
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
        <Squiggle key={name} delayMs={letters * 45 + 250} align={align} />
      </div>
      <PrivacyToggle isPublic={isPublic} editable={editable} />
    </div>
  );
}
