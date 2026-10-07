import { deckLanguageInfo, searchLanguages } from '@pictiotheme/game-core';
import type { DeckLanguage } from '@pictiotheme/protocol';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { saveRoomLanguage } from '../../../lib/room-language';
import { sendToRoom } from '../../../realtime';
import { WOBBLE } from '../../../ui/hand-drawn';
import { LanguageFlag } from '../../../ui/LanguageFlag';
import { useFindDeckInLanguage } from '../api';

/**
 * The room's language (decks.md#languages), on the room card: its flag and name. The host opens
 * it to type a language ("deutsch", "portug…") and pick it from the list. The room switches to the
 * deck's translation when there is one; otherwise the deck library offers to translate it. The
 * choice is remembered for the host's next room.
 */
export function LanguagePicker({
  language,
  deckId,
  editable,
}: {
  language: DeckLanguage;
  /** The room's deck, to switch to its translation. */
  deckId: string;
  editable: boolean;
}) {
  const info = deckLanguageInfo(language);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [switching, setSwitching] = useState(false);
  const findInLanguage = useFindDeckInLanguage();
  const ref = useRef<HTMLDivElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  /** Where the list opens: under the button, in the viewport (it's portalled, see below). */
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null);
  const listId = useId();
  const optionId = (code: string) => `${listId}-${code}`;
  const matches = searchLanguages(query);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!ref.current?.contains(target) && !popup.current?.contains(target)) setOpen(false);
    };
    // The list is fixed in the viewport, so it follows the button when the page scrolls.
    const place = () => {
      const rect = trigger.current?.getBoundingClientRect();
      if (rect) setAnchor({ top: rect.bottom + 8, left: rect.left });
    };
    place();
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open]);

  function openList() {
    setQuery('');
    setActive(
      Math.max(
        0,
        searchLanguages('').findIndex((l) => l.code === language),
      ),
    );
    setOpen(true);
  }

  function close() {
    setOpen(false);
    trigger.current?.focus();
  }

  async function pick(next: DeckLanguage) {
    close();
    if (next === language) return;
    saveRoomLanguage(next);
    setSwitching(true);
    let translated: string | null = null;
    try {
      translated = (await findInLanguage(deckId, next))?.id ?? null;
    } catch {
      // The library offers the translation instead.
    }
    setSwitching(false);
    sendToRoom({
      t: 'room:settings',
      settings: {
        language: next,
        ...(translated && translated !== deckId && { deckId: translated }),
      },
    });
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((i) => (i + step + matches.length) % Math.max(1, matches.length));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const chosen = matches[active];
      if (chosen) void pick(chosen.code);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      close();
    }
  }

  const label = (
    <>
      <LanguageFlag language={language} className="h-5" label={false} />
      <span className="font-hand text-xl leading-none">{info.native}</span>
    </>
  );

  if (!editable) {
    return (
      <span
        data-testid="room-language"
        title={`Cards are in ${info.name}`}
        className="inline-flex items-center gap-2"
      >
        {label}
      </span>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        ref={trigger}
        type="button"
        data-testid="room-language"
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={switching}
        title={`Cards are in ${info.name}. Click to change the language.`}
        onClick={() => (open ? setOpen(false) : openList())}
        className={`inline-flex items-center gap-2 ${WOBBLE[1]} border-[2px_2.5px_3px_2px] border-ink bg-paper px-2.5 py-1 shadow-[2px_3px_0_var(--color-ink)] transition hover:-translate-y-0.5 focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-dashed focus-visible:outline-ink disabled:opacity-60`}
      >
        {label}
        <span aria-hidden="true" className="text-sm text-ink/60">
          {switching ? '…' : '▾'}
        </span>
        <span className="sr-only">Change the room’s language</span>
      </button>
      {/* Portalled: the room card clips what overflows it (its ticket shape). */}
      {open &&
        anchor &&
        createPortal(
          <div
            ref={popup}
            style={{ top: anchor.top, left: anchor.left }}
            className={`fixed z-50 flex w-80 scheme-light flex-col gap-2 ${WOBBLE[0]} border-[2.5px_3px_3.5px_2.5px] border-ink bg-paper p-2.5 text-ink shadow-[4px_5px_0_var(--color-ink)]`}
          >
            <input
              autoFocus
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-activedescendant={matches[active] ? optionId(matches[active].code) : undefined}
              aria-label="Type a language"
              value={query}
              placeholder="Type a language…"
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onKeyDown}
              className="rounded-lg border-2 border-ink/30 bg-white px-2.5 py-1.5 text-sm focus:border-ink focus:outline-none"
            />
            <ul
              id={listId}
              role="listbox"
              aria-label="Languages"
              className="max-h-64 overflow-y-auto overscroll-contain"
            >
              {matches.length === 0 && (
                <li className="px-2 py-3 text-sm text-ink/60">
                  No deck language matches “{query.trim()}” yet.
                </li>
              )}
              {matches.map((l, i) => (
                <li
                  key={l.code}
                  id={optionId(l.code)}
                  role="option"
                  aria-selected={l.code === language}
                  onPointerEnter={() => setActive(i)}
                  onClick={() => void pick(l.code)}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm ${
                    i === active ? 'bg-pop-sun/50' : ''
                  }`}
                >
                  <LanguageFlag language={l.code} className="h-4" label={false} />
                  <span className="font-medium whitespace-nowrap">{l.native}</span>
                  {l.native !== l.name && (
                    <span className="min-w-0 truncate text-ink/60">{l.name}</span>
                  )}
                  {l.code === language && <span className="ml-auto">✓</span>}
                </li>
              ))}
            </ul>
          </div>,
          document.body,
        )}
    </div>
  );
}
