import type { CardOption, CardVote, RoomDeck } from '@pictiotheme/protocol';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { serverNow } from '../../../realtime';
import { playSound } from '../../sound';
import { CardBack, CardDeck } from './CardDeck';

/**
 * The choosing phase as a card table: the deck shuffles, deals the cards, and (for the drawer)
 * flips them face up. Spectators see the same deal, face down.
 *
 * Timeline (ms): shuffle 0–600 → card i lands at 600 + 120i (+450) → flips (+400).
 */
const SHUFFLE_MS = 600; // 2 × --animate-deck-riffle-*
const DEAL_GAP_MS = 120;
const DEAL_MS = 450; // --animate-card-deal
const PICK_MS = 300; // --animate-card-pick
/** Joining (or reconnecting) late in the phase skips the show and goes straight to the cards. */
const MIN_TIME_FOR_INTRO_MS = 5000;

const DIFFICULTY_LABEL = { easy: 'Easy', medium: 'Medium', hard: 'Hard' } as const;
const MULTIPLIER = { easy: '×1', medium: '×1.2', hard: '×1.5' } as const;
/** Cards land slightly askew, like they were tossed onto a table. */
const TILTS = ['-4deg', '1deg', '5deg'];

const dealDelay = (i: number) => SHUFFLE_MS + i * DEAL_GAP_MS;

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

type Props = {
  endsAt: number;
  /** Whose back cover the cards and the pile show. */
  deck: RoomDeck | null;
  /**
   * The drawer's options (face up), or how many face-down cards a spectator sees. `onVote`: the
   * drawer rates an option 👍/👎 (null takes it back) without picking it.
   */
  cards:
    | {
        options: CardOption[];
        onPick: (index: number) => void;
        onVote?: (index: number, vote: CardVote | null) => void;
      }
    | { count: number };
  header: ReactNode;
  footer?: ReactNode;
};

export function CardTable({ endsAt, deck, cards, header, footer }: Props) {
  const [intro] = useState(
    () => !prefersReducedMotion() && endsAt - serverNow() > MIN_TIME_FOR_INTRO_MS,
  );
  const [dealt, setDealt] = useState(!intro);
  const [picked, setPicked] = useState<number | null>(null);
  const [votes, setVotes] = useState<Record<number, CardVote>>({});
  const deckRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLElement | null)[]>([]);
  const pickTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const options = 'options' in cards ? cards.options : null;
  const count = options ? options.length : 'count' in cards ? cards.count : 0;

  // Each card deals out of the deck: give it the offset from its own spot back to the deck.
  useLayoutEffect(() => {
    const deck = deckRef.current?.getBoundingClientRect();
    if (!intro || !deck) return;
    for (const card of cardRefs.current) {
      if (!card) continue;
      // Measure the card's own spot, not where a previous run already moved it (StrictMode).
      card.style.removeProperty('--from-x');
      card.style.removeProperty('--from-y');
      const box = card.getBoundingClientRect();
      const dx = deck.left + deck.width / 2 - (box.left + box.width / 2);
      const dy = deck.top + deck.height / 2 - (box.top + box.height / 2);
      card.style.setProperty('--from-x', `${dx}px`);
      card.style.setProperty('--from-y', `${dy}px`);
    }
  }, [intro]);

  useEffect(() => () => clearTimeout(pickTimer.current), []);

  // Sounds follow the same timeline as the animation: shuffle, a slide per card, the flips.
  const faceUp = options !== null;
  useEffect(() => {
    if (!intro) return;
    // On timers, even the first one, so a cleanup (StrictMode, leaving early) cancels them all.
    const timers = [
      setTimeout(() => playSound('cardShuffle'), 0),
      ...Array.from({ length: count }, (_, i) => [
        setTimeout(() => playSound('cardDeal'), dealDelay(i)),
        ...(faceUp ? [setTimeout(() => playSound('cardFlip'), dealDelay(i) + DEAL_MS)] : []),
      ]).flat(),
    ];
    return () => timers.forEach(clearTimeout);
  }, [intro, count, faceUp]);

  const pick = (index: number) => {
    if (!options || picked !== null) return;
    setPicked(index);
    playSound('cardPick');
    // Let the chosen card pop before the phase ends and the overlay goes away.
    const onPick = 'onPick' in cards ? cards.onPick : null;
    pickTimer.current = setTimeout(() => onPick?.(index), prefersReducedMotion() ? 0 : PICK_MS);
  };

  // Each slot is a container, so the face's padding and gap scale with the card, not the board.
  const slotClass = (i: number) =>
    [
      '@container relative aspect-[3/4] w-[min(10rem,26cqw)] rotate-(--tilt) perspective-distant motion-reduce:animate-none',
      intro ? 'animate-card-deal' : '',
      picked === null ? '' : picked === i ? 'animate-card-pick' : 'animate-card-discard',
    ].join(' ');
  const slotStyle = (i: number) =>
    ({
      '--tilt': TILTS[i % TILTS.length],
      animationDelay: picked === null ? `${dealDelay(i)}ms` : '0ms',
    }) as CSSProperties;

  return (
    <>
      <CardDeck ref={deckRef} deck={deck} shuffling={intro} />
      {header}
      <div className="flex justify-center gap-[3cqw]">
        {Array.from({ length: count }, (_, i) => {
          const option = options?.[i];
          if (!option) {
            return (
              <div
                key={i}
                ref={(el) => {
                  cardRefs.current[i] = el;
                }}
                aria-hidden="true"
                style={slotStyle(i)}
                className={slotClass(i)}
              >
                <CardBack deck={deck} className="size-full" />
              </div>
            );
          }
          const isLast = i === count - 1;
          const onVote = 'onVote' in cards ? cards.onVote : undefined;
          return (
            <div
              key={option.text}
              ref={(el) => {
                cardRefs.current[i] = el;
              }}
              style={slotStyle(i)}
              // The slot straightens and lifts while its card is hovered or focused.
              className={`${slotClass(i)} transition-[rotate,translate] has-[>button:enabled:hover]:-translate-y-1 has-[>button:enabled:hover]:rotate-0 has-[>button:enabled:focus-visible]:-translate-y-1 has-[>button:enabled:focus-visible]:rotate-0`}
            >
              <button
                type="button"
                disabled={!dealt || picked !== null}
                onClick={() => pick(i)}
                className="group size-full"
              >
                <div
                  className={`relative size-full transform-3d motion-reduce:animate-none ${intro ? 'animate-card-flip' : ''}`}
                  style={{ animationDelay: `${dealDelay(i) + DEAL_MS}ms` }}
                  onAnimationEnd={(e) => {
                    if (isLast && e.animationName === 'card-flip') setDealt(true);
                  }}
                >
                  <span className="@container absolute inset-0 flex flex-col items-center justify-center gap-[6cqw] rounded-lg border-2 border-zinc-200 bg-white p-[8%] shadow-md backface-hidden group-enabled:group-hover:border-brand-600 group-focus-visible:border-brand-600 dark:border-zinc-700 dark:bg-zinc-900">
                    <span className="text-[13cqw] leading-tight font-bold text-balance break-words">
                      {option.text}
                    </span>
                    <span className="text-[9cqw] text-zinc-500">
                      {option.silly
                        ? '🤪 Silly ×1.5'
                        : `${DIFFICULTY_LABEL[option.difficulty]} ${MULTIPLIER[option.difficulty]}`}
                    </span>
                  </span>
                  <CardBack deck={deck} className="absolute inset-0 rotate-y-180 backface-hidden" />
                </div>
              </button>
              {onVote && dealt && picked === null && (
                <CardVoteButtons
                  card={option.text}
                  vote={votes[i] ?? null}
                  onVote={(vote) => {
                    setVotes((v) => {
                      const next = { ...v };
                      if (vote) next[i] = vote;
                      else delete next[i];
                      return next;
                    });
                    onVote(i, vote);
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
      {footer}
    </>
  );
}

/** 👍/👎 under a face-up option. Pressing the active one again takes the vote back. */
function CardVoteButtons({
  card,
  vote,
  onVote,
}: {
  card: string;
  vote: CardVote | null;
  onVote: (vote: CardVote | null) => void;
}) {
  const button = (value: CardVote, icon: string, label: string) => (
    <button
      type="button"
      aria-label={`${label}: ${card}`}
      title={label}
      aria-pressed={vote === value}
      onClick={() => onVote(vote === value ? null : value)}
      className={`rounded-full px-2 py-0.5 text-sm ring-1 pointer-coarse:px-3 pointer-coarse:py-1.5 ${
        vote === value
          ? 'bg-brand-600 text-white ring-brand-600'
          : 'bg-white/90 ring-zinc-300 hover:bg-white dark:bg-zinc-900/90 dark:ring-zinc-700'
      }`}
    >
      {icon}
    </button>
  );
  return (
    <div
      role="group"
      aria-label={`Rate ${card}`}
      className="absolute top-full left-1/2 mt-2 flex -translate-x-1/2 gap-1"
    >
      {button('up', '👍', 'Good card')}
      {button('down', '👎', 'Bad card')}
    </div>
  );
}
