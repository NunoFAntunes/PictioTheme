import type { Team } from '@pictiotheme/protocol/tower';
import { useServerNow, type RoomEvent, type RoomView } from '../../../realtime';
import { curseNames } from '../../../lib/curses';
import { SPELL_LABEL } from '../../../lib/spells';
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
    case 'sent': {
      const curse = event.curses?.length ? ` (${curseNames(event.curses)})` : '';
      return mine
        ? `🌀 Incoming: ${word}${curse} from ${name(event.playerId)}`
        : `🌀 ${name(event.playerId)} cursed ${word}${curse} and sent it to ${CREW_NAME[event.team]}`;
    }
    case 'fumble':
      return mine
        ? '💥 A piece fell off your tower!'
        : `💥 ${CREW_NAME[event.team]} fumbled a piece`;
    case 'expired':
      return mine ? `⏱ Nobody got ${word}` : null;
    case 'blank':
      return mine ? 'That drawing was too faint to build with' : null;
    case 'gained': {
      if (!event.spell) return null;
      const spell = `${SPELL_LABEL[event.spell].icon} ${SPELL_LABEL[event.spell].name}`;
      const why =
        event.reason === 'golden'
          ? '✨ Golden word!'
          : event.reason === 'star'
            ? '⭐ Star caught!'
            : '🆘 Hang in there!';
      return mine
        ? `${why} Your crew got ${spell}`
        : `${why} ${CREW_NAME[event.team]} got ${spell}`;
    }
    case 'cast': {
      if (!event.spell) return null;
      const spell = `${SPELL_LABEL[event.spell].icon} ${SPELL_LABEL[event.spell].name}`;
      return mine
        ? `${spell} incoming from ${name(event.playerId)}!`
        : `${name(event.playerId)} cast ${spell} at ${CREW_NAME[event.team]}`;
    }
    case 'magpied': {
      const whose = event.playerId === view.you ? 'Your' : `${name(event.playerId)}'s`;
      return mine
        ? `🐦‍⬛ A magpie took your ${word}!`
        : `🐦‍⬛ ${whose} magpie took ${CREW_NAME[event.team]}'s ${word}!`;
    }
    case 'solved':
      return null;
  }
}

/** The latest big moment (a steal, a curse, a fumble) for a few seconds. */
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
      className="pointer-events-none rounded-2xl bg-ink/90 px-5 py-2 font-display text-lg text-sun shadow-2xl"
    >
      {message(event, view, team)}
    </div>
  );
}
