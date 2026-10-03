import { normalizeRoomCode } from '@pictiotheme/game-core';
import { Link, useParams } from 'react-router';

export function RoomPage() {
  const params = useParams();
  const result = normalizeRoomCode(params.code ?? '');

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col items-center justify-center gap-4 px-4 text-center">
      {result.ok ? (
        <>
          <p className="text-zinc-500">Room</p>
          <h1 className="font-mono text-5xl font-bold tracking-widest">{result.code}</h1>
          <p className="text-zinc-500">Live rooms arrive with the realtime server.</p>
        </>
      ) : (
        <h1 className="text-2xl font-semibold">That doesn’t look like a room code.</h1>
      )}
      <Link to="/play" className="text-brand-600 underline">
        Back to the lobby
      </Link>
    </main>
  );
}
