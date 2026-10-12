import { expect, test } from '@playwright/test';
import { hostRoom, newPlayerPage } from './support';

/** The host's deck picker in the waiting room, over the seeded curated decks (db:migrate seeds them). */

test('pick a deck from the featured row and search', async ({ browser }) => {
  const page = await newPlayerPage(browser);
  await hostRoom(page, 'Ana');

  const featured = page.getByRole('region', { name: 'Featured' });
  const more = page.getByRole('region', { name: 'More decks' });
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
  await expect(more.getByRole('radio', { name: /Inventions Nobody Asked For/ })).toBeChecked();
  // Picking it changed the room's deck, for everyone.
  await expect(page.getByTestId('room-deck')).toHaveAttribute(
    'title',
    /Inventions Nobody Asked For/,
  );

  await page.getByLabel('Search decks').fill('zzzzqqq');
  await expect(page.getByText('No decks match “zzzzqqq”.')).toBeVisible();
});
