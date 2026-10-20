import type { Team } from '@pictiotheme/protocol/tower';

export const CREW_NAME: Record<Team, string> = { orange: 'Orange', teal: 'Teal' };

export const CREW_TEXT: Record<Team, string> = {
  orange: 'text-crew-orange',
  teal: 'text-crew-teal',
};

export const CREW_BG: Record<Team, string> = {
  orange: 'bg-crew-orange',
  teal: 'bg-crew-teal',
};

/** A crew's name on its colour, like a sticker. */
export function CrewBadge({ team, label }: { team: Team; label?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 font-display text-xs tracking-wider text-ink ${CREW_BG[team]}`}
    >
      {label ?? `${CREW_NAME[team]} crew`}
    </span>
  );
}
