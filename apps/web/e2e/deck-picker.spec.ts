import { expect, test } from '@playwright/test';
import { newPlayerPage, pickIdentity } from './support';

/** The create-room deck picker over the seeded curated decks (db:migrate seeds them). */

test('pick a deck from the featured row, show more, and search', async ({ browser }) => {
  const page = await newPlayerPage(browser);
  await page.goto('/play');
  await pickIdentity(page, 'Ana', /play/i);

  const featured = page.getByRole('region', { name: 'Featured' });
  const more = page.getByRole('region', { name: 'More decks' });
  // The first featured deck is selected to start with.
  await expect(featured.getByRole('radio').first()).toBeChecked();
  await expect(featured.getByRole('radio', { name: /Spooky Halloween/ })).toBeChecked();

  // Sections show a few decks until expanded.
  const collapsed = await more.getByRole('radio').count();
  await more.getByRole('button', { name: /Show all \d+ decks/ }).click();
  expect(await more.getByRole('radio').count()).toBeGreaterThan(collapsed);

  // Search matches titles and tags, with typos.
  await page.getByLabel('Search decks').fill('dinosaur');
  const results = page.getByRole('region', { name: 'Results' });
  await expect(results.getByRole('radio')).toHaveCount(1);
  await results.getByRole('radio').check({ force: true });
  await page.getByLabel('Search decks').fill('');
  await expect(more.getByRole('radio', { name: /Dinosaur/ })).toBeChecked();

  await page.getByLabel('Search decks').fill('zzzzqqq');
  await expect(page.getByText('No decks match “zzzzqqq”.')).toBeVisible();
});
