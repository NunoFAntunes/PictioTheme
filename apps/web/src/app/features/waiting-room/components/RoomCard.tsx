import { deckLanguageInfo } from '@pictiotheme/game-core';
import { useState } from 'react';
import type { RoomView } from '../../../realtime';
import { WOBBLE } from '../../../ui/hand-drawn';
import { DeckCover } from '../../deck-cover';
import { ReportDeckButton } from '../../report-deck';
import { LanguagePicker } from '../../room-language';
import { copyShareCardImage } from '../share-card';
import { RoomTitle } from './RoomTitle';

/**
 * The room's card at the top of the waiting room (screens.md §3): a ticket drawn in ink on ruled
 * paper, with the deck's cover on the left, the room's name (and public/private) on top, the rules
 * as little stickers, and a tear-off stub with the code. Kept short so the host's workspace fits. It's what an invite looks like: the server
 * draws the same card for link previews and "Copy as image" (apps/server share-card.ts).
 */

const POPS = ['pop-sun', 'pop-teal', 'pop-pink', 'pop-purple', 'pop-tomato'] as const;
/** The code's letters, in the logo's order of colours like the share card's. */
const CODE_POPS = ['pop-purple', 'pop-tomato', 'pop-sun', 'pop-teal', 'pop-pink'] as const;

/** "3 rounds", "80s to draw", "Easy · Medium", "Silly mode!": the rules at a glance. */
function rulesOf(view: RoomView): string[] {
  const s = view.settings;
  const difficulties = s.difficulties.map((d) => d[0]?.toUpperCase() + d.slice(1));
  return [
    `${s.rounds} round${s.rounds === 1 ? '' : 's'}`,
    `${s.drawSeconds}s to draw`,
    difficulties.join(' · '),
    ...(s.silly.enabled ? ['Silly mode!'] : []),
  ];
}

/** A strip of sticky tape holding the card to the sheet, with torn ends. */
function Tape({ className }: { className: string }) {
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute z-10 h-7 w-28 opacity-75 [clip-path:polygon(0_0,4%_25%,0_50%,4%_75%,0_100%,100%_100%,96%_75%,100%_50%,96%_25%,100%_0)] ${className}`}
    />
  );
}

function RuleSticker({ label, index }: { label: string; index: number }) {
  const pop = POPS[index % POPS.length] ?? 'pop-sun';
  return (
    <li
      className={`${WOBBLE[index % WOBBLE.length]} border-2 border-ink px-3 py-0.5 font-hand text-lg whitespace-nowrap text-ink shadow-[2px_3px_0_var(--color-ink)]`}
      style={{
        backgroundColor: `color-mix(in oklch, var(--color-${pop}) 35%, var(--color-paper))`,
        rotate: `${index % 2 ? 1.5 : -1.5}deg`,
      }}
    >
      {label}
    </li>
  );
}

function DeckOnCard({ view }: { view: RoomView }) {
  if (!view.deck) {
    return (
      <div className="grid aspect-[3/4] w-24 shrink-0 place-items-center font-hand text-ink/60">
        Loading the deck…
      </div>
    );
  }
  return (
    <div
      data-testid="room-deck"
      title={view.deck.title}
      className="relative w-24 shrink-0 -rotate-3 @3xl:w-28"
    >
      <div className="overflow-hidden rounded-xl border-[3px] border-ink shadow-[5px_6px_0_var(--color-ink)] [&>*]:w-full [&>*]:rounded-none [&>*]:border-0 [&>*]:text-base [&>*]:shadow-none">
        <DeckCover deck={view.deck} size="fill" />
      </div>
      <ReportDeckButton deck={view.deck} className="absolute -top-2 -right-2" />
    </div>
  );
}

/** The code, in sticker letters; clicking it copies the invite link. */
function Stub({ code }: { code: string }) {
  const [copied, setCopied] = useState<'link' | 'image' | 'opened' | 'failed' | null>(null);

  function flash(what: typeof copied) {
    setCopied(what);
    setTimeout(() => setCopied(null), 2_000);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${location.origin}/r/${code}`);
      flash('link');
    } catch {
      flash('failed');
    }
  }

  async function copyImage() {
    try {
      flash((await copyShareCardImage(code)) === 'copied' ? 'image' : 'opened');
    } catch {
      flash('failed');
    }
  }

  return (
    <div
      aria-live="polite"
      className="flex flex-col items-center justify-center gap-2 border-t-[5px] border-dotted border-ink/80 px-4 py-4 text-center @2xl:border-t-0 @2xl:border-l-[5px] [background:color-mix(in_oklch,var(--color-pop-sun)_22%,var(--color-paper))]"
    >
      <p className="font-hand text-lg leading-none text-ink/70">room code</p>
      <button
        type="button"
        onClick={() => void copyLink()}
        title="Copy the invite link"
        aria-label={`Room code ${code}: copy the invite link`}
        data-testid="room-code"
        className="flex items-center font-logo text-4xl leading-none tracking-wide transition hover:-rotate-2"
      >
        {code.split('-').map((half, h) => (
          <span key={h} className="flex items-center">
            {/* The dash stays in the text (it's what people type), drawn as a short stroke. */}
            {h > 0 && (
              <span className="mx-1.5 h-1.5 w-4 overflow-hidden rounded-full bg-ink text-[0]">
                -
              </span>
            )}
            <span>
              {[...half].map((char, i) => (
                <span
                  key={i}
                  className="inline-block [paint-order:stroke_fill] [text-shadow:0.05em_0.06em_0_var(--color-ink)] [-webkit-text-stroke:0.07em_var(--color-ink)]"
                  style={{
                    color: `var(--color-${CODE_POPS[(h * 3 + i) % CODE_POPS.length]})`,
                    rotate: `${((h * 3 + i) % 3) * 3 - 3}deg`,
                  }}
                >
                  {char}
                </span>
              ))}
            </span>
          </span>
        ))}
      </button>
      <div className="flex flex-col items-center gap-1">
        <button
          type="button"
          onClick={() => void copyLink()}
          className={`${WOBBLE[0]} border-2 border-ink bg-paper px-3 py-1 text-sm font-semibold text-ink shadow-[2px_3px_0_var(--color-ink)] transition hover:-translate-y-0.5 active:translate-y-0 active:shadow-none`}
        >
          {copied === 'link'
            ? '✓ Link copied'
            : copied === 'failed'
              ? "Couldn't copy. Try again?"
              : 'Copy invite link'}
        </button>
        <button
          type="button"
          onClick={() => void copyImage()}
          title="Copy this card as a picture"
          className="font-hand text-base text-ink/70 underline decoration-wavy decoration-pop-purple/60 underline-offset-4 hover:text-ink"
        >
          {copied === 'image'
            ? '✓ Card copied'
            : copied === 'opened'
              ? 'Opened in a new tab'
              : 'or copy it as a picture'}
        </button>
      </div>
    </div>
  );
}

export function RoomCard({ view, host }: { view: RoomView; host: boolean }) {
  return (
    <section
      aria-label="Room card"
      className="@container relative mx-auto w-full max-w-5xl scheme-light"
    >
      <Tape className="-top-3 -left-4 -rotate-[30deg] bg-pop-sun" />
      <Tape className="-top-2 -right-5 rotate-[26deg] bg-pop-teal" />
      <div
        className={`relative grid overflow-hidden ${WOBBLE[0]} border-ink border-[3px_4px_4.5px_3px] bg-paper text-ink shadow-[6px_7px_0_var(--color-ink)] @2xl:grid-cols-[minmax(0,1fr)_14rem]`}
      >
        <div className="flex min-w-0 flex-col items-center gap-5 p-4 [background:repeating-linear-gradient(to_bottom,transparent_0_2.6rem,color-mix(in_oklch,var(--color-paper-line)_60%,transparent)_2.6rem_calc(2.6rem+2px))] @xl:flex-row @xl:items-center @xl:p-5 @xl:pl-7">
          <DeckOnCard view={view} />
          <div className="flex w-full min-w-0 flex-col gap-2">
            <p className="font-hand text-lg leading-none text-ink/70">
              Come draw &amp; guess with us in
            </p>
            <RoomTitle name={view.name} isPublic={view.isPublic} editable={host} align="start" />
            {view.deck && (
              <p className="flex min-w-0 items-baseline gap-2 font-hand">
                <span className="text-lg text-ink/70">Deck:</span>
                <span className="truncate text-2xl leading-tight">{view.deck.title}</span>
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-hand text-lg text-ink/70">Cards in:</span>
              <LanguagePicker
                language={view.settings.language}
                deckId={view.settings.deckId}
                editable={host}
              />
              {view.deck && view.deck.language !== view.settings.language && (
                <span
                  role="status"
                  title={`This deck is in ${deckLanguageInfo(view.deck.language).name}: ${
                    host
                      ? 'translate it in the deck library below, or pick another deck.'
                      : 'the host needs to translate it, or pick another, before starting.'
                  }`}
                  className="rotate-2 rounded-full border-2 border-dashed border-pop-tomato px-1 font-hand text-[0.95rem] leading-snug whitespace-nowrap text-pop-tomato"
                >
                  Needs translation
                </span>
              )}
            </div>
            <ul aria-label="Rules" className="mt-1 flex flex-wrap gap-2.5">
              {rulesOf(view).map((label, i) => (
                <RuleSticker key={label} label={label} index={i} />
              ))}
            </ul>
          </div>
        </div>
        <Stub code={view.code} />
      </div>
    </section>
  );
}
