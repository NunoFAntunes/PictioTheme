import { useRef } from 'react';
import { Avatar } from '../../app/features/avatar';
import { IdentityForm } from '../../app/features/identity';
import type { Identity } from '../../app/lib/identity';

/** "Playing as 🥒 Sneaky Pickle ✏️": shows who you are and opens the name/avatar editor. */
export function IdentityChip({ identity }: { identity: Identity }) {
  const dialog = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className="flex items-center gap-2 rounded-full border-2 border-ink bg-white py-1 pr-3 pl-1 text-sm text-ink shadow-[2px_2px_0_var(--color-ink)] transition hover:-translate-y-0.5"
        title="Change your name or draw your avatar"
      >
        <Avatar src={identity.avatar} size="sm" />
        <span>
          <span className="text-ink/60">Playing as </span>
          <span className="font-bold">{identity.displayName}</span>
        </span>
        <span aria-hidden="true">✏️</span>
      </button>
      <dialog
        ref={dialog}
        aria-label="Your name and avatar"
        className="m-auto rounded-2xl bg-white p-0 text-ink shadow-xl backdrop:bg-ink/40"
        onClick={(e) => {
          // A click on the backdrop (the dialog element itself, outside the form) closes it.
          if (e.target === e.currentTarget) dialog.current?.close();
        }}
      >
        <IdentityForm submitLabel="Save" onDone={() => dialog.current?.close()} />
      </dialog>
    </>
  );
}
