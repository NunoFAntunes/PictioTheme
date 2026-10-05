import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { IdentityChip, useEnsureIdentity } from '../../app/features/identity';
import { JoinRoomForm } from '../../app/features/join-room';
import { RoomNotes, useCreateRoom, useQuickPlay } from '../../app/features/lobby';
import { isThisDeviceAPhone } from '../../app/lib/device';
import type { Identity } from '../../app/lib/identity';
import { DOODLE_BUTTON, WOBBLE } from '../../app/ui/hand-drawn';
import { BoltIcon, LockIcon } from '../../app/ui/ScribbleIcons';

const queryClient = new QueryClient();

/** Rooms live in the app's shell page: entering one is a full page load (frontend-guidelines W2). */
function enterRoom(code: string) {
  window.location.assign(`/r/${code}`);
}

/**
 * The home page's lobby, under the logo (user-flows.md §2, screens.md §1): every way into a game
 * is one click, and nobody fills in a form first.
 */
export function HomeLobby() {
  return (
    <QueryClientProvider client={queryClient}>
      <Lobby />
    </QueryClientProvider>
  );
}

function Lobby() {
  const identity = useEnsureIdentity();
  const [phone] = useState(isThisDeviceAPhone);
  const [showAnyway, setShowAnyway] = useState(false);

  if (phone && !showAnyway) {
    return (
      <div className="mt-10 flex flex-col items-center gap-3 text-ink">
        <p className="max-w-xs text-lg">
          Drawing on a phone is no fun. Open this page on a tablet or a computer to play.
        </p>
        <button type="button" onClick={() => setShowAnyway(true)} className="underline">
          Show me anyway
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-10">
      {identity && (
        <div className="absolute -top-16 left-0">
          <IdentityChip identity={identity} />
        </div>
      )}
      <Actions identity={identity} />
      <RoomNotes />
    </div>
  );
}

function Actions({ identity }: { identity: Identity | null }) {
  const quickPlay = useQuickPlay();
  const createRoom = useCreateRoom();
  const busy =
    quickPlay.isPending || createRoom.isPending || quickPlay.isSuccess || createRoom.isSuccess;
  const error = quickPlay.error ?? createRoom.error;

  function onQuickPlay() {
    if (!identity) return;
    const { displayName, avatar } = identity;
    quickPlay.mutate({ displayName, avatar }, { onSuccess: (room) => enterRoom(room.code) });
  }

  function onNewRoom() {
    if (!identity) return;
    const { displayName, avatar } = identity;
    createRoom.mutate(
      { displayName, avatar, name: `${displayName}'s room`, isPublic: false },
      { onSuccess: (room) => enterRoom(room.code) },
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex flex-wrap items-center justify-center gap-4">
        <button
          type="button"
          onClick={onQuickPlay}
          disabled={!identity || busy}
          className={`${DOODLE_BUTTON} ${WOBBLE[0]} -rotate-2 bg-pop-purple py-3 pr-8 pl-5 text-3xl text-white`}
        >
          <BoltIcon className="size-10 shrink-0 text-ink" />
          {quickPlay.isPending || quickPlay.isSuccess ? 'Finding a room…' : 'Quick play'}
        </button>
        <button
          type="button"
          onClick={onNewRoom}
          disabled={!identity || busy}
          className={`${DOODLE_BUTTON} ${WOBBLE[1]} rotate-1 bg-pop-sun py-2.5 pr-6 pl-4 text-xl text-ink`}
        >
          <LockIcon className="size-8 shrink-0" />
          {createRoom.isPending || createRoom.isSuccess ? 'Making your room…' : 'New private room'}
        </button>
        <JoinRoomForm onJoin={enterRoom} onPaper />
      </div>
      {error && (
        <p className="text-close" role="alert">
          {error.message}
        </p>
      )}
    </div>
  );
}
