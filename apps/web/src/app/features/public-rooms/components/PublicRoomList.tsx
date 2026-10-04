import { Link } from 'react-router';
import { usePublicRooms } from '../api';

const DIFFICULTY_LETTER = { easy: 'E', medium: 'M', hard: 'H' } as const;

/** The lobby's live list of public rooms (user-flows.md §3). */
export function PublicRoomList() {
  const rooms = usePublicRooms();

  return (
    <section aria-labelledby="public-rooms" className="flex flex-col gap-2">
      <h2 id="public-rooms" className="text-lg font-semibold">
        Public rooms
      </h2>
      {rooms.isPending && <p className="text-zinc-500">Loading…</p>}
      {rooms.isError && <p className="text-close">Couldn’t load the room list.</p>}
      {rooms.data?.length === 0 && (
        <p className="text-zinc-500">No public rooms right now. Create one!</p>
      )}
      <ul className="flex flex-col divide-y divide-zinc-200 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {rooms.data?.map((room) => {
          const full = room.players >= room.maxPlayers;
          return (
            <li key={room.code}>
              <Link
                to={`/r/${room.code}`}
                aria-disabled={full}
                className={`flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900 ${full ? 'pointer-events-none opacity-50' : ''}`}
              >
                <span className="flex-1">
                  <span className="block font-medium">{room.name}</span>
                  <span className="block text-sm text-zinc-500">
                    {room.deckTitle ?? 'Choosing a deck'} ·{' '}
                    {room.difficulties.map((d) => DIFFICULTY_LETTER[d]).join(' ')}
                    {room.silly && ' 🤪'}
                  </span>
                </span>
                <span className="text-sm tabular-nums">
                  {room.players}/{room.maxPlayers}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${room.status === 'waiting' ? 'bg-solved/20' : 'bg-zinc-200 dark:bg-zinc-800'}`}
                >
                  {full ? 'full' : room.status === 'waiting' ? 'waiting' : 'in game'}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
