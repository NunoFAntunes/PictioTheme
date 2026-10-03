import { JoinRoomForm } from '../../features/join-room';
import { ServerStatus } from '../../features/server-status';

export function LobbyPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-10 px-4 py-10">
      <header className="flex items-center justify-between">
        <a href="/" className="font-display text-2xl font-bold">
          Pictio<span className="text-brand-600">Theme</span>
        </a>
        <ServerStatus />
      </header>

      <section className="flex flex-col items-start gap-6">
        <JoinRoomForm />
        <button
          type="button"
          disabled
          className="rounded-lg border border-zinc-300 px-4 py-2 font-semibold text-zinc-400 dark:border-zinc-700"
        >
          Create room (coming soon)
        </button>
      </section>

      <section aria-labelledby="public-rooms" className="flex flex-col gap-2">
        <h2 id="public-rooms" className="text-lg font-semibold">
          Public rooms
        </h2>
        <p className="text-zinc-500">No public rooms yet.</p>
      </section>
    </main>
  );
}
