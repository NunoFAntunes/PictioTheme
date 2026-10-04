import { useId, useState, type SubmitEvent } from 'react';
import { useNavigate } from 'react-router';
import type { Identity } from '../../../lib/identity';
import { GenerateDeckPanel, useGenerationConfig, useMyDecks } from '../../generate-deck';
import { useCreateRoom, useDecks } from '../api';
import { DeckPicker } from './DeckPicker';

/**
 * Room name, public/private and deck (screens.md §3). Everything else has defaults and is
 * changed in the waiting room.
 */
export function CreateRoomForm({ identity }: { identity: Identity }) {
  const navigate = useNavigate();
  const decks = useDecks();
  const myDecks = useMyDecks();
  const generationEnabled = useGenerationConfig().data?.enabled === true;
  const createRoom = useCreateRoom();
  const [generating, setGenerating] = useState(false);
  const [name, setName] = useState(`${identity.displayName}'s room`);
  const [isPublic, setIsPublic] = useState(false);
  const [deckId, setDeckId] = useState<string | null>(null);
  const nameId = useId();
  const allDecks = [...(myDecks.data ?? []), ...(decks.data ?? [])].filter(
    (d, i, all) => all.findIndex((x) => x.id === d.id) === i,
  );
  const selectedDeck = deckId ?? allDecks[0]?.id ?? null;

  function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    createRoom.mutate(
      {
        name: name.trim(),
        isPublic,
        displayName: identity.displayName,
        avatar: identity.avatar,
        ...(selectedDeck && { deckId: selectedDeck }),
      },
      { onSuccess: (room) => void navigate(`/r/${room.code}`) },
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex w-full flex-col gap-4 rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800"
    >
      <h2 className="text-lg font-semibold">Create a room</h2>
      <div className="flex flex-wrap items-end gap-3">
        <label htmlFor={nameId} className="flex flex-1 flex-col gap-1 text-sm font-medium">
          Room name
          <input
            id={nameId}
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            className="rounded-lg border border-zinc-300 bg-transparent px-3 py-2 font-normal dark:border-zinc-700"
          />
        </label>
        <fieldset className="flex gap-1 rounded-lg border border-zinc-300 p-1 text-sm dark:border-zinc-700">
          <legend className="sr-only">Visibility</legend>
          {[
            { value: false, label: '🔒 Private' },
            { value: true, label: '🌍 Public' },
          ].map((option) => (
            <button
              key={option.label}
              type="button"
              aria-pressed={isPublic === option.value}
              onClick={() => setIsPublic(option.value)}
              className={`rounded-md px-3 py-1 ${isPublic === option.value ? 'bg-brand-600 text-white' : ''}`}
            >
              {option.label}
            </button>
          ))}
        </fieldset>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Deck</legend>
        {decks.isPending && <p className="text-sm text-zinc-500">Loading decks…</p>}
        {decks.isError && <p className="text-sm text-close">Couldn’t load decks.</p>}
        <DeckPicker
          curated={decks.data ?? []}
          mine={myDecks.data ?? []}
          selectedId={selectedDeck}
          onSelect={(deck) => setDeckId(deck.id)}
        />
        {generationEnabled &&
          (generating ? (
            <GenerateDeckPanel
              onCancel={() => setGenerating(false)}
              onGenerated={(deck) => {
                setDeckId(deck.id);
                setGenerating(false);
              }}
            />
          ) : (
            <button
              type="button"
              onClick={() => setGenerating(true)}
              className="self-start rounded-lg border border-dashed border-brand-600/60 px-3 py-2 text-sm text-brand-700 hover:bg-brand-600/5 dark:text-brand-500"
            >
              ✨ Generate a deck
            </button>
          ))}
      </fieldset>

      {createRoom.isError && (
        <p className="text-sm text-close" role="alert">
          {createRoom.error.message}
        </p>
      )}
      <button
        type="submit"
        disabled={createRoom.isPending || name.trim().length < 2}
        className="self-end rounded-lg bg-brand-600 px-5 py-2 font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {createRoom.isPending ? 'Creating…' : 'Create room ▶'}
      </button>
    </form>
  );
}
