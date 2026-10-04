import type { GeneratedDeck } from '@pictiotheme/protocol';
import { afterAll, describe, expect, it } from 'vitest';
import { createDb } from '../../db/client';
import { testCover } from '../../test-support/avatar';
import { TEST_DATABASE_URL } from '../../test-support/test-config';
import { createDecksService, REPORTS_TO_HIDE } from './decks.service';

const { db, pool } = createDb(TEST_DATABASE_URL);
const decks = createDecksService({ db });

afterAll(async () => {
  await pool.end();
});

const generated: GeneratedDeck = {
  title: 'Pirate Party!',
  description: 'Arr.',
  tags: ['pirates'],
  cards: [
    { text: 'Parrot', difficulty: 'easy', silly: false, alternates: [], keywords: ['parrot'] },
    {
      text: 'Treasure map',
      difficulty: 'medium',
      silly: false,
      alternates: ['map'],
      keywords: ['map'],
    },
    {
      text: 'Walking the plank',
      difficulty: 'hard',
      silly: false,
      alternates: [],
      keywords: ['plank'],
    },
    {
      text: 'Parrot at the dentist',
      difficulty: 'medium',
      silly: true,
      alternates: [],
      keywords: ['parrot', 'dentist'],
    },
  ],
};

describe('decks service', () => {
  it('saves a generated deck that rooms can then play', async () => {
    const id = await decks.saveGeneratedDeck(generated, {
      theme: 'pirates',
      model: 'test/model',
      coverId: null,
    });

    expect(await decks.exists(id)).toBe(true);
    const playable = await decks.getPlayableDeck(id);
    expect(playable.title).toBe('Pirate Party!');
    expect(playable.cards).toEqual(expect.arrayContaining(generated.cards));
    expect(playable.cards).toHaveLength(4);

    expect(await decks.summaries([id])).toEqual([
      {
        id,
        title: 'Pirate Party!',
        description: 'Arr.',
        tags: ['pirates'],
        coverId: null,
        featured: false,
        counts: { easy: 1, medium: 1, hard: 1, silly: 1 },
      },
    ]);
  });

  it("gives rooms the deck's back cover", async () => {
    const id = await decks.saveGeneratedDeck(generated, {
      theme: 'pirates',
      model: null,
      coverId: null,
    });
    expect((await decks.getPlayableDeck(id)).coverId).toBeNull();

    const coverId = await decks.storeCover(testCover([0, 128, 255]));
    await decks.setCover(id, coverId);
    expect((await decks.getPlayableDeck(id)).coverId).toBe(coverId);
  });

  it('lists the seeded curated decks, featured first, and starts rooms with the first', async () => {
    const listed = await decks.listDecks();
    expect(listed[0]?.title).toBe('Spooky Halloween');
    expect(listed.map((d) => d.title)).toContain('Animal Kingdom');
    const defaultId = await decks.defaultDeckId();
    expect(defaultId).toBe(listed[0]?.id);
    const playable = await decks.getPlayableDeck(defaultId ?? '');
    expect(playable.cards.length).toBeGreaterThan(0);
  });

  it('searches titles and tags, tolerating typos', async () => {
    const titles = async (q: string) => (await decks.listDecks(q)).map((d) => d.title);
    expect((await titles('spooky'))[0]).toBe('Spooky Halloween');
    expect(await titles('october')).toContain('Spooky Halloween'); // a tag
    expect(await titles('halowen')).toContain('Spooky Halloween'); // a typo
    expect(await titles('animal')).toContain('Animal Kingdom');
    expect(await titles('%')).toEqual([]); // wildcards are text
    expect((await decks.listDecks('  '))[0]?.featured).toBe(true); // blank: the curated list
  });

  it('treats unknown and malformed ids as missing, without a database error', async () => {
    const unknown = '0190a000-0000-7000-8000-000000000000';
    expect(await decks.exists(unknown)).toBe(false);
    expect(await decks.exists("x'; drop table decks; --")).toBe(false);
    await expect(decks.getPlayableDeck(unknown)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(await decks.summaries([unknown, 'nope'])).toEqual([]);
  });
});

describe('deck reports', () => {
  const save = () =>
    decks.saveGeneratedDeck(generated, { theme: 'pirates', model: null, coverId: null });
  const reporters = (n: number, prefix = 'g_reporter') =>
    Array.from({ length: n }, (_, i) => `${prefix}-${i}-${Math.random()}`);

  it('hides a reported cover once enough different players report it, and a redraw shows again', async () => {
    const id = await save();
    const first = await decks.storeCover(testCover([200, 0, 0]));
    await decks.setCover(id, first);

    const [one, ...others] = reporters(REPORTS_TO_HIDE);
    // The same player reporting twice counts once.
    await decks.report(one ?? '', id, 'cover');
    await decks.report(one ?? '', id, 'cover');
    for (const r of others.slice(0, -1)) await decks.report(r, id, 'cover');
    expect((await decks.getPlayableDeck(id)).coverId).toBe(first);

    await decks.report(others.at(-1) ?? '', id, 'cover');
    expect((await decks.getPlayableDeck(id)).coverId).toBeNull();
    expect((await decks.summaries([id]))[0]?.coverId).toBeNull();
    // The deck itself stays playable.
    expect(await decks.exists(id)).toBe(true);

    // Setting the same drawing again keeps it hidden; a new drawing is shown, with a fresh count.
    await decks.setCover(id, first);
    expect((await decks.getPlayableDeck(id)).coverId).toBeNull();
    const second = await decks.storeCover(testCover([0, 200, 0]));
    await decks.setCover(id, second);
    expect((await decks.getPlayableDeck(id)).coverId).toBe(second);
    await decks.report(one ?? '', id, 'cover');
    expect((await decks.getPlayableDeck(id)).coverId).toBe(second);
  });

  it('hides a deck whose content enough different players report', async () => {
    const id = await save();
    for (const r of reporters(REPORTS_TO_HIDE - 1)) await decks.report(r, id, 'content');
    expect(await decks.exists(id)).toBe(true);

    await decks.report(reporters(1, 'g_last')[0] ?? '', id, 'content');
    expect(await decks.exists(id)).toBe(false);
    await expect(decks.getPlayableDeck(id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(await decks.summaries([id])).toEqual([]);
    await expect(decks.report('g_late', id, 'content')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('only takes reports about saved decks, and cover reports about a drawn cover', async () => {
    await expect(decks.report('g_x', 'builtin-halloween', 'content')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    const id = await save();
    await expect(decks.report('g_x', id, 'cover')).rejects.toMatchObject({ code: 'VALIDATION' });
  });

  it('never hides a curated deck automatically: its reports wait for a moderator', async () => {
    const curatedId = (await decks.defaultDeckId()) ?? '';
    for (const r of reporters(REPORTS_TO_HIDE)) await decks.report(r, curatedId, 'content');
    expect(await decks.exists(curatedId)).toBe(true);
  });
});
