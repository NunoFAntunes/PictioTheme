import { sendToRoom, myTeam, type RoomView } from '../../../realtime';
import { CURSE_LABEL } from '../../../lib/curses';
import { Button } from '../../../ui/Button';
import { useTestMode } from '../checklist';

/**
 * Test mode's guess line: no word to guess, just "I got it" for your crew's drawing, or for the
 * other crew's (a steal). You then decide Keep or Curse, as the drawer would in a match.
 */
export function TestGuess({
  view,
  disabledReason,
}: {
  view: RoomView;
  /** Why you can't guess right now (placing…), or null. */
  disabledReason: string | null;
}) {
  const curse = useTestMode((s) => s.curse);
  const team = myTeam(view);
  const other = team === 'orange' ? 'teal' : 'orange';
  const ownRound = Boolean(team && view.crews[team].round);
  const theirRound = view.settings.steals && Boolean(view.crews[other].round);
  const solve = (target: 'own' | 'steal') =>
    sendToRoom({
      t: 'test',
      action: { kind: 'solve', target, ...(curse && { curse }) },
    });

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-2">
        <Button
          variant="primary"
          className="h-12 flex-1 text-base"
          disabled={disabledReason !== null || !ownRound}
          onClick={() => solve('own')}
        >
          ✅ Guess ours
        </Button>
        <Button
          variant="sun"
          className="h-12 flex-1 text-base"
          disabled={disabledReason !== null || !theirRound}
          onClick={() => solve('steal')}
        >
          🥷 Steal theirs
        </Button>
      </div>
      <p className="text-center text-xs font-semibold text-ink/60">
        {disabledReason ??
          (curse
            ? `The piece gets ${CURSE_LABEL[curse].icon} ${CURSE_LABEL[curse].name}`
            : 'The piece rolls its curse as in a match')}
      </p>
    </div>
  );
}
