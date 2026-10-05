import { useRef, useState, type CSSProperties } from 'react';
import type { Identity } from '../../../lib/identity';
import { Avatar } from '../../avatar';
import { IdentityForm } from './IdentityForm';

/**
 * "Playing as 🥒 Sneaky Pickle ✏️": shows who you are and opens the name/avatar editor. `compact`
 * is the room header's "you" sticker: avatar, a "you" tag over your name (in `nameStyle`, the
 * handwriting the player list writes it in) and a ✏️ badge. `onSaved` gets the saved identity.
 */
export function IdentityChip({
  identity,
  compact = false,
  nameStyle,
  onSaved,
}: {
  identity: Identity;
  compact?: boolean;
  nameStyle?: CSSProperties;
  onSaved?: (identity: Identity) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  // The form only exists while open, so the page never has a second name field or pad.
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          dialog.current?.showModal();
        }}
        aria-label={
          compact ? `Playing as ${identity.displayName}: change name or drawing` : undefined
        }
        className={
          compact
            ? 'group flex max-w-[14rem] -rotate-2 items-center gap-2 rounded-full border-2 border-ink bg-pop-sun py-0.5 pr-1 pl-0.5 text-ink shadow-[2px_2px_0_var(--color-ink)] transition hover:-translate-y-0.5 hover:rotate-0 active:translate-y-0 active:shadow-none'
            : 'flex items-center gap-2 rounded-full border-2 border-ink bg-white py-1 pr-3 pl-1 text-sm text-ink shadow-[2px_2px_0_var(--color-ink)] transition hover:-translate-y-0.5'
        }
        title="Change your name or draw your avatar"
      >
        {compact ? (
          <>
            <span className="shrink-0 overflow-hidden rounded-lg border-2 border-ink bg-white transition-transform group-hover:-rotate-6">
              <Avatar src={identity.avatar} size="sm" />
            </span>
            <span className="flex min-w-0 flex-col items-start leading-none">
              <span className="rounded-sm bg-ink px-1 py-px text-[0.55rem] font-bold tracking-widest text-white uppercase">
                You
              </span>
              <span
                className="max-w-full truncate pt-0.5 [-webkit-text-stroke:0.035em_currentColor]"
                style={nameStyle}
              >
                {identity.displayName}
              </span>
            </span>
            <span
              aria-hidden="true"
              className="grid size-7 shrink-0 place-items-center rounded-full border-2 border-ink bg-white text-sm transition-transform group-hover:rotate-12"
            >
              ✏️
            </span>
          </>
        ) : (
          <>
            <Avatar src={identity.avatar} size="sm" />
            <span>
              <span className="text-ink/60">Playing as </span>
              <span className="font-bold">{identity.displayName}</span>
            </span>
            <span aria-hidden="true">✏️</span>
          </>
        )}
      </button>
      {/* data-paper: always light, like the paper it opens over. */}
      <dialog
        ref={dialog}
        data-paper
        aria-label="Your name and avatar"
        onClose={() => setOpen(false)}
        className="m-auto rounded-2xl bg-white p-0 text-ink shadow-xl backdrop:bg-ink/40"
        onClick={(e) => {
          // A click on the backdrop (the dialog element itself, outside the form) closes it.
          if (e.target === e.currentTarget) dialog.current?.close();
        }}
      >
        {open && (
          <IdentityForm
            submitLabel="Save"
            onSaved={onSaved}
            onDone={() => dialog.current?.close()}
          />
        )}
      </dialog>
    </>
  );
}
