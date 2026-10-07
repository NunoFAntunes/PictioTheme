import type { DeckSummary, GenerationJob } from '@pictiotheme/protocol';
import { expect, test, type Page } from '@playwright/test';
import { hostRoom } from './support';

/**
 * Generating a deck from the host's deck picker in the waiting room. CI never calls OpenRouter,
 * so the generation endpoints are stubbed in the browser, and the stubbed deck doesn't exist on
 * the server: the specs check that the client asks the room for it (`room:settings`). Playing a
 * generated deck is covered against the real server in apps/server (generation.e2e.test.ts).
 * Each test creates a room: run this file alone against a dev server with rate limits on.
 */

/** The deck ids this page asked the room to switch to. */
function deckRequests(page: Page): string[] {
  const ids: string[] = [];
  page.on('websocket', (ws) =>
    ws.on('framesent', ({ payload }) => {
      if (typeof payload !== 'string') return;
      const msg = JSON.parse(payload) as { t?: string; settings?: { deckId?: string } };
      if (msg.t === 'room:settings' && msg.settings?.deckId) ids.push(msg.settings.deckId);
    }),
  );
  return ids;
}

const DECK: DeckSummary = {
  id: '0190a000-0000-7000-8000-0000000000aa',
  title: 'Pirate Party',
  description: 'Arr.',
  tags: ['pirates'],
  coverId: null,
  featured: false,
  language: 'en',
  languages: ['en'],
  counts: { easy: 40, medium: 40, hard: 30, silly: 40 },
};

const job = (status: GenerationJob['status']): GenerationJob => ({
  id: '0190a000-0000-7000-8000-000000000001',
  kind: 'generate',
  status,
  theme: 'pirates',
  language: 'en',
  error: null,
  deck: status === 'published' ? DECK : null,
  createdAt: new Date().toISOString(),
});

const COVER_ID = 'c'.repeat(32);

test('generate a deck, draw its cover while waiting, and it becomes the selected deck', async ({
  page,
}) => {
  const requested = deckRequests(page);
  let published = false;
  let request: unknown = null;
  const cover: { image?: string } = {};
  await page.route('**/api/decks/generations/config', (route) =>
    route.fulfill({ json: { enabled: true, daily: null } }),
  );
  await page.route('**/api/decks/generations', (route) => {
    request = route.request().postDataJSON();
    return route.fulfill({ status: 202, json: job('running') });
  });
  await page.route('**/api/decks/generations/*-*', (route) =>
    route.fulfill({ json: job(published ? 'published' : 'running') }),
  );
  await page.route('**/api/decks/generations/*/cover', (route) => {
    cover.image = (route.request().postDataJSON() as { image: string }).image;
    return route.fulfill({ json: job('running') });
  });
  await page.route('**/api/decks/mine*', (route) =>
    route.fulfill({
      json: { decks: published ? [{ ...DECK, coverId: cover.image ? COVER_ID : null }] : [] },
    }),
  );
  await page.route(`**/api/decks/covers/${COVER_ID}`, (route) =>
    route.fulfill({
      contentType: 'image/png',
      body: Buffer.from(cover.image?.split(',')[1] ?? '', 'base64'),
    }),
  );

  await hostRoom(page, 'Ana');

  await page.getByRole('button', { name: /generate a deck/i }).click();
  await page.getByLabel('Theme').fill('pirates');
  // Turn hard off in the panel (the room settings below have their own Hard).
  await page
    .getByRole('group', { name: /Generate a deck/ })
    .getByRole('button', { name: 'Hard' })
    .click();
  await page.getByRole('button', { name: 'Generate' }).click();

  await expect(page.getByText('Making your “pirates” deck')).toBeVisible();
  await page.getByRole('button', { name: 'Save cover ✓' }).click();
  await expect(page.getByText('Draw something first')).toBeVisible();

  const padCanvas = page.getByLabel('Deck cover drawing pad');
  await padCanvas.scrollIntoViewIfNeeded(); // page.mouse doesn't scroll
  const pad = await padCanvas.boundingBox();
  if (!pad) throw new Error('no cover pad');
  await page.mouse.move(pad.x + pad.width * 0.2, pad.y + pad.height * 0.2);
  await page.mouse.down();
  await page.mouse.move(pad.x + pad.width * 0.8, pad.y + pad.height * 0.8, { steps: 10 });
  await page.mouse.up();
  await page.getByRole('button', { name: 'Save cover ✓' }).click();
  await expect(page.getByText('Cover saved ✓')).toBeVisible();
  expect(cover.image).toMatch(/^data:image\/png;base64,/);

  published = true; // the next poll sees the finished deck
  await expect.poll(() => requested).toContain(DECK.id); // the room is asked to switch to it
  await expect(page.getByRole('img', { name: 'Cover of Pirate Party' })).toHaveAttribute(
    'src',
    `/api/decks/covers/${COVER_ID}`,
  );
  expect(request).toEqual({
    theme: 'pirates',
    notes: '',
    difficulties: ['easy', 'medium'],
    silly: true,
    language: 'en',
  });
  await expect(page.getByRole('radio', { name: /Pirate Party/ })).toHaveValue(DECK.id);
  await expect(page.getByRole('button', { name: /generate a deck/i })).toBeVisible();
});

test('redraw the cover of one of your decks', async ({ page }) => {
  const cover: { image?: string } = {};
  await page.route('**/api/decks/mine*', (route) =>
    route.fulfill({ json: { decks: [{ ...DECK, coverId: cover.image ? COVER_ID : null }] } }),
  );
  await page.route(`**/api/decks/${DECK.id}/cover`, (route) => {
    cover.image = (route.request().postDataJSON() as { image: string }).image;
    return route.fulfill({ json: { ...DECK, coverId: COVER_ID } });
  });
  await page.route(`**/api/decks/covers/${COVER_ID}`, (route) =>
    route.fulfill({
      contentType: 'image/png',
      body: Buffer.from(cover.image?.split(',')[1] ?? '', 'base64'),
    }),
  );

  await hostRoom(page, 'Ana');

  await page.getByRole('button', { name: 'Redraw the cover of Pirate Party' }).click();
  await page.getByRole('button', { name: 'Save cover ✓' }).click();
  await expect(page.getByText('Draw something first')).toBeVisible();

  const padCanvas = page.getByLabel('Deck cover drawing pad');
  await padCanvas.scrollIntoViewIfNeeded();
  const pad = await padCanvas.boundingBox();
  if (!pad) throw new Error('no cover pad');
  await page.mouse.move(pad.x + pad.width * 0.3, pad.y + pad.height * 0.3);
  await page.mouse.down();
  await page.mouse.move(pad.x + pad.width * 0.7, pad.y + pad.height * 0.7, { steps: 10 });
  await page.mouse.up();
  await page.getByRole('button', { name: 'Save cover ✓' }).click();

  await expect(page.getByLabel('Deck cover drawing pad')).toHaveCount(0);
  expect(cover.image).toMatch(/^data:image\/png;base64,/);
  await expect(page.getByRole('img', { name: 'Cover of Pirate Party' })).toHaveAttribute(
    'src',
    `/api/decks/covers/${COVER_ID}`,
  );
});

test('a deck that finishes first waits for the cover to be finished or skipped', async ({
  page,
}) => {
  const requested = deckRequests(page);
  let published = false;
  await page.route('**/api/decks/generations/config', (route) =>
    route.fulfill({ json: { enabled: true, daily: null } }),
  );
  await page.route('**/api/decks/generations', (route) =>
    route.fulfill({ status: 202, json: job('running') }),
  );
  await page.route('**/api/decks/generations/*-*', (route) =>
    route.fulfill({ json: job(published ? 'published' : 'running') }),
  );
  await page.route('**/api/decks/mine*', (route) =>
    route.fulfill({ json: { decks: published ? [DECK] : [] } }),
  );

  await hostRoom(page, 'Cy');
  await page.getByRole('button', { name: /generate a deck/i }).click();
  await page.getByLabel('Theme').fill('pirates');
  await page.getByRole('button', { name: 'Generate' }).click();

  published = true;
  await expect(page.getByText('is ready! Finish your cover')).toBeVisible();
  await expect(page.getByLabel('Deck cover drawing pad')).toBeVisible();
  await page.getByRole('button', { name: 'Skip' }).click();
  await expect.poll(() => requested).toContain(DECK.id);
});

test("a player who used today's deck sees when the next one is available", async ({ page }) => {
  const nextAt = new Date(Date.now() + 5 * 3600_000 - 60_000).toISOString();
  await page.route('**/api/decks/generations/config', (route) =>
    route.fulfill({ json: { enabled: true, daily: { limit: 1, remaining: 0, nextAt } } }),
  );
  await hostRoom(page, 'Ana');
  await page.getByRole('button', { name: /generate a deck/i }).click();
  await page.getByLabel('Theme').fill('pirates');
  await expect(page.getByTestId('generation-allowance')).toHaveText(
    "You've used today's free deck. You can make another in about 5 h.",
  );
  await expect(page.getByRole('button', { name: 'Generate' })).toBeDisabled();
});

test('the generate button is hidden when the server has generation off', async ({ page }) => {
  await page.route('**/api/decks/generations/config', (route) =>
    route.fulfill({ json: { enabled: false, daily: null } }),
  );
  await hostRoom(page, 'Bo');
  await expect(page.getByRole('radio').first()).toBeVisible();
  await expect(page.getByRole('button', { name: /generate a deck/i })).toHaveCount(0);
});
