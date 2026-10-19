import type { VotedDeck } from '@pictiotheme/protocol';
import { DeckCover } from '../../deck-cover';

/**
 * A player's deck vote (game-rules.md#deck-votes): an auction paddle held up beside their doodle,
 * the deck's cover on its board. It's raised again each time the vote changes. For the host it's a
 * button that switches the room to that deck (`onPick`); the room's deck gets a ✓ instead.
 */
export function DeckPaddle({
  deck,
  voterName,
  playing,
  onPick,
}: {
  deck: VotedDeck;
  voterName: string;
  /** It's already the room's deck. */
  playing: boolean;
  /** The host: play this deck. */
  onPick?: (() => void) | undefined;
}) {
  const board = (
    <span
      // A new paddle per deck, so changing your vote raises it again.
      key={deck.id}
      className="flex origin-bottom rotate-12 flex-col items-center motion-safe:animate-paddle-raise"
    >
      <span className="relative rounded-[45%] border-[2.5px] border-ink bg-white p-2 shadow-[3px_3px_0_var(--color-ink)]">
        <DeckCover deck={deck} size="paddle" />
        {playing && (
          <span className="absolute -right-2 -bottom-1.5 grid size-6 place-items-center rounded-full border-2 border-ink bg-pop-sun text-xs font-bold text-ink">
            ✓
          </span>
        )}
      </span>
      <span className="-mt-0.5 h-8 w-2.5 rounded-b-sm border-x-2 border-b-2 border-ink bg-amber-600" />
    </span>
  );
  const label = `${voterName} votes for ${deck.title}`;
  if (!onPick || playing) {
    return (
      <span role="img" aria-label={playing ? `${label} (playing)` : label} title={label}>
        {board}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onPick}
      title={`${label}. Play it`}
      aria-label={`${label}. Play it`}
      className="block cursor-pointer rounded-lg transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink focus-visible:outline-dashed"
    >
      {board}
    </button>
  );
}
