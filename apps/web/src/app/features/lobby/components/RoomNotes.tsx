import type { PublicRoomSummary } from '@pictiotheme/protocol';
import { BoilFilters } from '../../player-list';
import { usePublicRooms } from '../api';

const DIFFICULTY_LETTER = { easy: 'E', medium: 'M', hard: 'H' } as const;
const NOTE_COLOURS = ['bg-pop-sun/45', 'bg-pop-pink/35', 'bg-pop-teal/35', 'bg-pop-purple/25'];
const TILTS = ['-rotate-2', 'rotate-1', '-rotate-1', 'rotate-2'];

/**
 * The home page's live public rooms, as sticky notes on the paper (screens.md §1). Each note is a
 * plain link: entering a room loads the app's room page.
 */
export function RoomNotes() {
  const lobby = usePublicRooms();
  const rooms = lobby.data?.rooms;
  const online = lobby.data?.online ?? 0;

  return (
    <section aria-labelledby="public-rooms" className="flex flex-col gap-3">
      <h2 id="public-rooms" className="flex items-baseline justify-center gap-2 text-lg font-bold">
        Public rooms
        {online > 0 && (
          <span className="text-sm font-medium text-ink/60">· {online} doodling now</span>
        )}
      </h2>
      {lobby.isError && <p className="text-close">Couldn’t load the room list.</p>}
      {rooms?.length === 0 && (
        <p className="text-ink/60">No public rooms yet. Quick play starts one!</p>
      )}
      {/* The covers boil like the players' doodles. */}
      <BoilFilters />
      {rooms && rooms.length > 0 && (
        <ul className="flex flex-wrap justify-center gap-4">
          {rooms.map((room, i) => (
            <li key={room.code}>
              <RoomNote room={room} index={i} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RoomNote({ room, index }: { room: PublicRoomSummary; index: number }) {
  const full = room.players >= room.maxPlayers;
  const colour = NOTE_COLOURS[index % NOTE_COLOURS.length];
  const tilt = TILTS[index % TILTS.length];
  const status = full ? 'Full' : room.status === 'waiting' ? 'Waiting' : 'In game';
  const body = (
    <>
      <span className="line-clamp-1 font-bold leading-tight">{room.name}</span>
      <span className="line-clamp-1 text-sm text-ink/70">
        {room.deckTitle ?? 'Choosing a deck'}
        {room.silly && ' 🤪'}
      </span>
      {/* The room's most-liked drawing, cut out, boiling like the players (game-rules.md). */}
      <span className="flex min-h-0 flex-1 items-center justify-center">
        {room.coverVersion !== null && (
          <img
            src={`/api/rooms/${room.code}/cover?v=${room.coverVersion}`}
            alt={`The most-liked drawing in ${room.name}`}
            className="max-h-full max-w-full object-contain motion-safe:animate-boil"
          />
        )}
      </span>
      <span className="mt-auto flex items-center justify-between text-sm">
        <span className="tabular-nums">
          {room.players}/{room.maxPlayers} ·{' '}
          {room.difficulties.map((d) => DIFFICULTY_LETTER[d]).join(' ')}
        </span>
        <span className="flex items-center gap-1 text-xs font-semibold">
          <span
            aria-hidden="true"
            className={`size-2 rounded-full ${full ? 'bg-ink/30' : room.status === 'waiting' ? 'bg-solved' : 'bg-pop-tomato'}`}
          />
          {status}
        </span>
      </span>
    </>
  );
  const note = `flex h-44 w-48 flex-col gap-1 p-3 text-left text-ink shadow-[2px_4px_0_rgb(0_0_0/0.12)] ${colour} ${tilt}`;

  if (full) {
    return (
      <div aria-disabled="true" className={`${note} opacity-50`}>
        {body}
      </div>
    );
  }
  return (
    <a
      href={`/r/${room.code}`}
      aria-label={`Join ${room.name}: ${room.players} of ${room.maxPlayers} players, ${status.toLowerCase()}`}
      className={`${note} transition hover:z-10 hover:scale-105 hover:rotate-0 hover:shadow-[4px_8px_0_rgb(0_0_0/0.15)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ink`}
    >
      {body}
    </a>
  );
}
