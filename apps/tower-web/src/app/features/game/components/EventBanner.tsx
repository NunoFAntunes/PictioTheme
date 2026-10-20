import type { Team } from '@pictiotheme/protocol/tower';
import { useServerNow, type RoomEvent, type RoomView } from '../../../realtime';
import { CREW_NAME } from '../../../ui/CrewBadge';

const SHOW_MS = 3_500;

function message(event: RoomEvent, view: RoomView, team: Team): string | null {
  const name = (id?: string) =>
    id === view.you ? 'You' : (view.players.find((p) => p.id === id)?.name ?? 'Someone');
  const mine = event.team === team;
  const word = event.word ? `“${event.word}”` : '';
  switch (event.kind) {
    case 'stolen':
      return mine
        ? `🦝 ${name(event.playerId)} stole your ${word}!`
        : `🦝 ${name(event.playerId)} stole ${CREW_NAME[event.team]}'s ${word}!`;
    case 'sent':
      return mine
        ? `💣 Incoming: ${word} from ${name(event.playerId)}`
        : `💣 ${name(event.playerId)} sent ${word} to ${CREW_NAME[event.team]}`;
    case 'fumble':
      return mine
        ? '💥 A piece fell off your tower!'
        : `💥 ${CREW_NAME[event.team]} fumbled a piece`;
    case 'expired':
      return mine ? `⏱ Nobody got ${word}` : null;
    case 'blank':
      return mine ? 'That drawing was too faint to build with' : null;
    case 'solved':
      return null;
  }
}

/** The latest big moment (a steal, a send, a fumble) for a few seconds. */
export function EventBanner({ view, team }: { view: RoomView; team: Team }) {
  const now = useServerNow(500);
  const event = [...view.events]
    .reverse()
    .find((e) => now - e.at < SHOW_MS && message(e, view, team));
  if (!event) return null;
  return (
    <div
      key={event.key}
      role="status"
      className="pointer-events-none rounded-lg bg-ink/90 px-5 py-2 font-display text-lg text-hazard shadow-2xl"
    >
      {message(event, view, team)}
    </div>
  );
}
