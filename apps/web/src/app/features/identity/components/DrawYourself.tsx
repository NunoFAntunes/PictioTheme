import { useState } from 'react';
import { useIdentity } from '../../../lib/identity';
import { useUpdateIdentityInRoom } from '../api';
import { hasGeneratedAvatar } from '../generated-avatar';
import { IdentityForm } from './IdentityForm';

/**
 * "Draw yourself!" in the waiting room (user-flows.md §5): players who never drew an avatar (they
 * got their initial with a silly name) draw one while friends arrive. Saving updates the room.
 */
export function DrawYourself({ roomCode }: { roomCode: string }) {
  const identity = useIdentity((s) => s.identity);
  const update = useUpdateIdentityInRoom(roomCode);
  const [open, setOpen] = useState(() => identity !== null && hasGeneratedAvatar(identity));
  if (!identity) return null;

  if (!open) {
    return (
      <p className="text-center text-sm text-zinc-500">
        {update.isSuccess && 'Looking good! '}
        <button type="button" onClick={() => setOpen(true)} className="text-brand-600 underline">
          ✏️ Change your name or drawing
        </button>
      </p>
    );
  }

  return (
    <section aria-labelledby="draw-yourself" className="flex flex-col items-center gap-2">
      <h2 id="draw-yourself" className="text-lg font-semibold">
        Draw yourself! <span aria-hidden="true">🖍️</span>
      </h2>
      <p className="text-sm text-zinc-500">Everyone in the room will see it.</p>
      <IdentityForm
        submitLabel="Save"
        onSaved={({ displayName, avatar }) => update.mutate({ displayName, avatar })}
        onDone={() => setOpen(false)}
      />
      {update.isError && (
        <p className="text-sm text-close" role="alert">
          {update.error.message}
        </p>
      )}
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-sm text-zinc-500 underline"
      >
        Not now
      </button>
    </section>
  );
}
