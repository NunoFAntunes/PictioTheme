import type { DeckSummary } from '@pictiotheme/protocol';
import { expect } from '@playwright/test';
import { hostRoom, newPlayerPage, test } from './support';

/** The host's deck picker in the waiting room, over the seeded curated decks (db:migrate seeds them). */

test('pick a deck from the featured row and search', async ({ browser }) => {
  const page = await newPlayerPage(browser);
  await hostRoom(page, 'Ana');

  const featured = page.getByRole('region', { name: 'Featured' });
  // The room starts with the default deck: the first featured one.
  await expect(featured.getByRole('radio').first()).toBeChecked();
  await expect(featured.getByRole('radio', { name: /Halloween Night/ })).toBeChecked();

  // Search matches titles and tags, with typos.
  await page.getByLabel('Search decks').fill('inventions nobdy asked');
  const results = page.getByRole('region', { name: 'Results' });
  await expect(results.getByRole('radio')).toHaveCount(1);
  // The radio shows the room's deck, so it turns on once the server applies the change.
  await results.getByRole('radio').click({ force: true });
  await expect(results.getByRole('radio')).toBeChecked();
  await page.getByLabel('Search decks').fill('');
  await expect(featured.getByRole('radio', { name: /Inventions Nobody Asked For/ })).toBeChecked();
  // Picking it changed the room's deck, for everyone.
  await expect(page.getByTestId('room-deck')).toHaveAttribute(
    'title',
    /Inventions Nobody Asked For/,
  );

  await page.getByLabel('Search decks').fill('zzzzqqq');
  await expect(page.getByText('No decks match “zzzzqqq”.')).toBeVisible();
});

const COMMUNITY_DECK: DeckSummary = {
  id: '0190a000-0000-7000-8000-00000000c0de',
  title: 'Robot Picnic',
  description: 'Beep boop sandwiches.',
  tags: ['robots'],
  coverId: null,
  featured: false,
  language: 'en',
  languages: ['en'],
  counts: { easy: 30, hard: 20, chaos: 0 },
};

test('turn the page to the community decks and back', async ({ browser }) => {
  const page = await newPlayerPage(browser);
  await page.route('**/api/decks/community*', (route) =>
    route.fulfill({ json: { decks: [COMMUNITY_DECK], nextOffset: null } }),
  );
  await hostRoom(page, 'Ana');

  const featured = page.getByRole('region', { name: 'Featured' });
  const community = page.getByRole('region', { name: 'Community' });
  await expect(featured.getByRole('radio', { name: /Halloween Night/ })).toBeVisible();
  await expect(community).toBeHidden();

  await page.getByRole('button', { name: 'Turn to the community decks' }).click();
  await expect(community.getByRole('radio', { name: /Robot Picnic/ })).toBeVisible();
  await expect(featured).toBeHidden();

  // The ribbon does nothing while a page is still turning (700ms), which a slow runner can hit.
  await expect(async () => {
    await page.getByRole('button', { name: 'Turn back to the featured decks' }).click();
    await expect(featured.getByRole('radio', { name: /Halloween Night/ })).toBeVisible({
      timeout: 1000,
    });
  }).toPass();
  await expect(community).toBeHidden();

  // Pulling the ribbon down and letting go turns the page too (once the last turn has finished).
  const ribbon = page.getByRole('button', { name: 'Turn to the community decks' });
  await expect(async () => {
    const box = await ribbon.boundingBox();
    if (!box) throw new Error('No ribbon');
    await page.mouse.move(box.x + box.width / 2, box.y + 10);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + 90, { steps: 8 });
    await page.mouse.up();
    await expect(community.getByRole('radio', { name: /Robot Picnic/ })).toBeVisible({
      timeout: 1000,
    });
  }).toPass();
  await page.getByRole('button', { name: 'Turn back to the featured decks' }).click();

  // A search covers every deck, so the ribbon goes while it shows.
  await page.getByLabel('Search decks').fill('halloween');
  await expect(page.getByRole('button', { name: /Turn to the community/ })).toHaveCount(0);
});
