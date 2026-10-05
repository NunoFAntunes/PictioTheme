import { useState } from 'react';
import { useIdentity } from '../../../lib/identity';
import { useUpdateIdentityInRoom } from '../api';
import { hasGeneratedAvatar } from '../generated-avatar';
import { IdentityForm } from './IdentityForm';

/**
 * "Draw yourself!" in the waiting room (user-flows.md §5): players who never drew an avatar (they
 * got their initial with a silly name) draw one while friends arrive. Saving updates the room.
 * `startFolded` (the host, who has a room to set up) shows a prompt instead of the open pad. Once
 * you've drawn, it's gone: the room header's "you" sticker changes your name or drawing.
 */
export function DrawYourself({
  roomCode,
  startFolded = false,
}: {
  roomCode: string;
  startFolded?: boolean;
}) {
  const identity = useIdentity((s) => s.identity);
  const update = useUpdateIdentityInRoom(roomCode);
  const [open, setOpen] = useState(
    () => !startFolded && identity !== null && hasGeneratedAvatar(identity),
  );
  if (!identity) return null;

  if (!open && hasGeneratedAvatar(identity) && !update.isSuccess) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center justify-center gap-2 self-center rounded-full border-2 border-dashed border-pop-pink px-4 py-1.5 text-sm hover:bg-pop-pink/10"
      >
        <span aria-hidden="true">🖍️</span>
        <span>
          You’re still a plain letter. <strong>Draw yourself</strong> while friends arrive!
        </span>
      </button>
    );
  }

  // Already drawn, or done for now: the header's "you" sticker changes it from here on.
  if (!open) return null;

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
