import { useState } from 'react';
import { useIdentity } from '../../lib/identity';
import { Avatar } from '../../features/avatar';
import { CreateRoomForm } from '../../features/create-room';
import { IdentityForm } from '../../features/identity';
import { JoinRoomForm } from '../../features/join-room';
import { PublicRoomList } from '../../features/public-rooms';
import { ServerStatus } from '../../features/server-status';
import { SoundSettingsButton } from '../../features/sound';

export function LobbyPage() {
  const identity = useIdentity((s) => s.identity);
  const [editing, setEditing] = useState(false);

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-8 px-4 py-8">
      <header className="flex items-center justify-between gap-4">
        <a href="/" className="font-display text-2xl font-bold">
          Pictio<span className="text-brand-600">Theme</span>
        </a>
        <div className="flex items-center gap-3">
          <ServerStatus />
          {identity && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="flex items-center gap-2 rounded-full border border-zinc-200 py-1 pr-3 pl-1 text-sm dark:border-zinc-800"
              title="Change name or avatar"
            >
              <Avatar src={identity.avatar} size="sm" />
              {identity.displayName}
            </button>
          )}
          <SoundSettingsButton />
        </div>
      </header>

      {!identity || editing ? (
        <section className="flex flex-col items-center gap-4">
          <h1 className="text-2xl font-semibold">Who’s playing?</h1>
          <IdentityForm submitLabel="Let’s play ▶" onDone={() => setEditing(false)} />
        </section>
      ) : (
        <>
          {/* Side by side on wide screens; stacked on tablets in portrait, join (short) first. */}
          <section className="flex flex-col gap-6 lg:flex-row lg:items-start">
            <div className="flex-1">
              <CreateRoomForm identity={identity} />
            </div>
            <div className="order-first lg:order-none">
              <JoinRoomForm />
            </div>
          </section>
          <PublicRoomList />
        </>
      )}
    </main>
  );
}
