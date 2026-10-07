import type { DeckSummary, GenerationJob } from '@pictiotheme/protocol';
import { expect, test, type Page } from '@playwright/test';
import { hostRoom } from './support';

/**
 * The room's language (decks.md#languages): the host types a language on the room card, the
 * library marks decks that aren't in it, and the room's deck is translated before the match can
 * start. CI never calls OpenRouter, so translation and generation endpoints are stubbed in the
 * browser; the stubbed deck doesn't exist on the server, so the specs check what the client asks
 * the room for (`room:settings`). The server side is covered in generation.e2e.test.ts.
 */

type Sent = { t?: string; settings?: { deckId?: string; language?: string } };

/** The `room:settings` this page sent. */
function settingsSent(page: Page): Sent['settings'][] {
  const sent: Sent['settings'][] = [];
  page.on('websocket', (ws) =>
    ws.on('framesent', ({ payload }) => {
      if (typeof payload !== 'string') return;
      const msg = JSON.parse(payload) as Sent;
      if (msg.t === 'room:settings') sent.push(msg.settings);
    }),
  );
  return sent;
}

const GERMAN_DECK: DeckSummary = {
  id: '0190a000-0000-7000-8000-0000000000de',
  title: 'Halloween auf Deutsch',
  description: '',
  tags: ['halloween'],
  coverId: null,
  featured: false,
  language: 'de',
  languages: ['en', 'de'],
  counts: { easy: 40, medium: 40, hard: 30, silly: 40 },
};

const job = (status: GenerationJob['status']): GenerationJob => ({
  id: '0190a000-0000-7000-8000-0000000000ff',
  kind: 'translate',
  status,
  theme: 'Halloween',
  language: 'de',
  error: null,
  deck: status === 'published' ? GERMAN_DECK : null,
  createdAt: new Date().toISOString(),
});

async function pickLanguage(page: Page, typed: string, option: string) {
  await page.getByTestId('room-language').click();
  await page.getByRole('combobox', { name: 'Type a language' }).fill(typed);
  await expect(page.getByRole('option', { name: new RegExp(option) })).toBeVisible();
  await page.keyboard.press('Enter');
}

test('the host picks a language, and the deck is translated before the match', async ({ page }) => {
  const sent = settingsSent(page);
  let translated = false;
  // No translation yet, whatever the dev database holds.
  await page.route('**/api/decks/*/translations/*', (route) =>
    route.fulfill({ status: 404, json: { error: { code: 'NOT_FOUND', message: 'No' } } }),
  );
  await page.route('**/api/decks/*/translations', (route) =>
    route.fulfill({ json: { status: 'translating', job: job('running') } }),
  );
  await page.route('**/api/decks/generations/*-*', (route) =>
    route.fulfill({ json: job(translated ? 'published' : 'running') }),
  );

  await hostRoom(page, 'Ana');
  await expect(page.getByTestId('room-language')).toContainText('English');

  await pickLanguage(page, 'deuts', 'Deutsch');
  await expect.poll(() => sent.at(-1)).toEqual({ language: 'de' });
  await expect(page.getByTestId('room-language')).toContainText('Deutsch');

  // The room's deck is still in English: everyone is told, the host is offered a translation,
  // and the match can't start.
  await expect(page.getByText('Needs translation')).toBeVisible();
  await expect(page.getByTestId('needs-translation').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start game ▶' })).toBeDisabled();
  const panel = page.getByTestId('translate-deck');
  await expect(panel).toHaveAccessibleName(/into German/);

  await panel.getByRole('button', { name: 'Translate into Deutsch' }).click();
  await expect(panel.getByRole('status')).toContainText('Translating');
  translated = true; // the next poll sees the finished translation
  await expect.poll(() => sent.at(-1)).toEqual({ deckId: GERMAN_DECK.id });
});

test('a new deck is generated in the room’s language, and a theme in another one is refused', async ({
  page,
}) => {
  let request: unknown = null;
  await page.route('**/api/decks/generations/config', (route) =>
    route.fulfill({ json: { enabled: true, daily: null } }),
  );
  await page.route('**/api/decks/*/translations/*', (route) =>
    route.fulfill({ status: 404, json: { error: { code: 'NOT_FOUND', message: 'No' } } }),
  );
  await page.route('**/api/decks/generations', (route) => {
    request = route.request().postDataJSON();
    return route.fulfill({
      status: 422,
      json: {
        error: {
          code: 'THEME_WRONG_LANGUAGE',
          message: 'Your theme looks like English, but this room plays in Portuguese (Portugal).',
        },
      },
    });
  });

  await hostRoom(page, 'Ana');
  await pickLanguage(page, 'portug', 'Português \\(Portugal\\)');
  await expect(page.getByTestId('room-language')).toContainText('Português (Portugal)');

  await page.getByRole('button', { name: /generate a deck/i }).click();
  await expect(page.getByTestId('generation-language')).toContainText('Português (Portugal)');
  await page.getByLabel('Theme').fill('pirates');
  await page.getByRole('button', { name: 'Generate' }).click();

  await expect(page.getByRole('alert')).toContainText('looks like English');
  expect(request).toMatchObject({ theme: 'pirates', language: 'pt-PT' });
  // Nothing started: the form is still there to fix the theme.
  await expect(page.getByLabel('Theme')).toHaveValue('pirates');
});
