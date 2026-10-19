import { useState } from 'react';
import { amHost, playerById, sendToRoom, useRoomStore, type RoomView } from '../../../realtime';
import { DOODLE_BUTTON, WOBBLE } from '../../../ui/hand-drawn';
import { avatarUrl } from '../../avatar';
import { DeckCover } from '../../deck-cover';
import { DeckVoteDialog } from '../../deck-picker';
import { tallyVotes, voteCounts, type DeckTally } from '../tally';

/**
 * Deck votes between matches (game-rules.md#deck-votes, screens.md §3 and §6): everyone but the
 * host gets "Vote for the next deck!", which opens the deck library; the deck they tap goes up on
 * a paddle beside their doodle (DeckPaddle, in the player list). Under it, the votes so far, most
 * voted first, with who voted. The host can play a voted deck from here.
 */
export function DeckVotes() {
  const view = useRoomStore((s) => s.view);
  const [open, setOpen] = useState(false);
  if (!view) return null;
  const host = amHost(view);
  const tally = tallyVotes(
    view.deckVotes,
    view.players.map((p) => p.id),
  );
  const voted = view.deckVotes[view.you] ?? null;
  if (host && tally.length === 0) return null;

  return (
    <section aria-label="Deck votes" className="flex flex-col items-center gap-2">
      {!host && (
        <>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={`${DOODLE_BUTTON} ${WOBBLE[2]} rotate-1 bg-pop-sun px-5 py-1.5 text-lg text-ink`}
          >
            <span aria-hidden="true">🙋</span>
            {voted ? 'Change my deck vote' : 'Vote for the next deck!'}
          </button>
          <DeckVoteDialog
            open={open}
            onClose={() => setOpen(false)}
            language={view.settings.language}
            votedId={voted?.id ?? null}
            votes={voteCounts(view.deckVotes)}
            onVote={(deckId) => {
              sendToRoom({ t: 'deck:vote', deckId });
              setOpen(false);
            }}
          />
        </>
      )}
      {tally.length > 0 && (
        <div className="flex flex-col items-center gap-1">
          <h3 className="font-hand text-lg text-ink/70 dark:text-zinc-300">
            {host ? 'The players would like to play…' : 'Votes so far'}
          </h3>
          <ul className="flex flex-wrap justify-center gap-2">
            {tally.map((t) => (
              <TallyEntry key={t.deck.id} tally={t} view={view} host={host} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function TallyEntry({ tally, view, host }: { tally: DeckTally; view: RoomView; host: boolean }) {
  const { deck, voters } = tally;
  const playing = view.settings.deckId === deck.id;
  const names = voters.map((id) => playerById(view, id)?.name ?? 'Someone');
  return (
    <li
      data-testid="deck-vote-tally"
      className="flex items-center gap-2 rounded-xl border-2 border-ink/70 bg-white/80 py-1 pr-2 pl-1 text-ink shadow-[2px_2px_0_var(--color-ink)]"
    >
      <DeckCover deck={deck} size="sm" />
      <div className="flex min-w-0 flex-col">
        <span className="max-w-40 truncate font-hand text-lg leading-tight">{deck.title}</span>
        <span className="flex items-center gap-1 text-xs text-ink/60">
          <span className="font-semibold tabular-nums">
            {voters.length} {voters.length === 1 ? 'vote' : 'votes'}
          </span>
          <span className="flex -space-x-1.5" title={names.join(', ')}>
            {voters.slice(0, 5).map((id, i) => {
              const player = playerById(view, id);
              return player ? (
                <img
                  key={id}
                  src={avatarUrl(player.avatar)}
                  alt={names[i]}
                  draggable={false}
                  className="size-5 rounded-full border border-ink/40 bg-white object-contain"
                />
              ) : null;
            })}
          </span>
        </span>
      </div>
      {host &&
        (playing ? (
          <span className="ml-1 rounded-full bg-pop-sun px-2 text-xs font-semibold">✓ Playing</span>
        ) : (
          <button
            type="button"
            onClick={() => sendToRoom({ t: 'room:settings', settings: { deckId: deck.id } })}
            className="ml-1 rounded-full border-2 border-ink bg-pop-purple px-2.5 py-0.5 text-sm font-semibold text-white hover:-translate-y-0.5"
          >
            Play it
          </button>
        ))}
    </li>
  );
}
