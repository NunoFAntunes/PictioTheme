import { useRef, useState } from 'react';
import type { Identity } from '../../../lib/identity';
import { Avatar } from '../../avatar';
import { IdentityForm } from './IdentityForm';

/**
 * "Playing as 🥒 Sneaky Pickle ✏️": shows who you are and opens the name/avatar editor. `compact`
 * is the room header's version (avatar and ✏️ only). `onSaved` gets the saved identity.
 */
export function IdentityChip({
  identity,
  compact = false,
  onSaved,
}: {
  identity: Identity;
  compact?: boolean;
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
        className="flex items-center gap-2 rounded-full border-2 border-ink bg-white py-1 pr-3 pl-1 text-sm text-ink shadow-[2px_2px_0_var(--color-ink)] transition hover:-translate-y-0.5"
        title="Change your name or draw your avatar"
      >
        <Avatar src={identity.avatar} size="sm" />
        {!compact && (
          <span>
            <span className="text-ink/60">Playing as </span>
            <span className="font-bold">{identity.displayName}</span>
          </span>
        )}
        <span aria-hidden="true">✏️</span>
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
