import type { AddChaosResponse, GenerationJob } from '@pictiotheme/protocol';
import { expect, test } from '@playwright/test';
import { followInvite, hostRoom, newPlayerPage } from './support';

/**
 * Chaos mode (game-rules.md#card-pool): a room deck without Chaos cards can't start a Chaos match
 * until a host has them made (decks.md#chaos-cards). The curated decks have none yet.
 */

test('Chaos mode asks for the deck’s Chaos cards before the match can start', async ({
  browser,
}) => {
  const host = await newPlayerPage(browser);
  const bo = await newPlayerPage(browser);
  const code = await hostRoom(host, 'Ana');
  await followInvite(bo, code, 'Bo');
  const start = host.getByRole('button', { name: /start game/i });
  await expect(start).toBeEnabled();

  let asked: string | null = null;
  await host.route('**/api/decks/*/chaos', async (route) => {
    asked = new URL(route.request().url()).pathname;
    const job: GenerationJob = {
      id: '0190a000-0000-7000-8000-0000000000c1',
      kind: 'chaos',
      status: 'running',
      theme: 'Deck',
      language: 'en',
      error: null,
      deck: null,
      createdAt: new Date().toISOString(),
    };
    await route.fulfill({ json: { status: 'generating', job } satisfies AddChaosResponse });
  });
  await host.route('**/api/decks/generations/*', (route) =>
    route.fulfill({
      json: {
        id: '0190a000-0000-7000-8000-0000000000c1',
        kind: 'chaos',
        status: 'running',
        theme: 'Deck',
        language: 'en',
        error: null,
        deck: null,
        createdAt: new Date().toISOString(),
      } satisfies GenerationJob,
    }),
  );

  await host.getByRole('group', { name: 'Mode' }).getByRole('button', { name: /Chaos/ }).click();
  // Chaos has no difficulties, and everyone sees it on the room card.
  await expect(host.getByRole('group', { name: 'Difficulty' })).toHaveCount(0);
  await expect(bo.getByRole('list', { name: 'Rules' }).getByText('Chaos mode!')).toBeVisible();
  await expect(bo.getByText('Needs Chaos cards')).toBeVisible();
  await expect(start).toBeDisabled();
  await expect(host.getByText(/Make the deck’s Chaos cards/)).toBeVisible();

  const panel = host.getByTestId('chaos-cards');
  await panel.getByRole('button', { name: /Make Chaos cards/ }).click();
  await expect(panel.getByRole('status')).toHaveText(/Making Chaos cards/);
  expect(asked).toMatch(/^\/api\/decks\/[0-9a-f-]{36}\/chaos$/);

  // Back to normal: the deck's easy and hard cards are enough.
  await host.getByRole('group', { name: 'Mode' }).getByRole('button', { name: 'Normal' }).click();
  await expect(host.getByTestId('chaos-cards')).toHaveCount(0);
  await expect(start).toBeEnabled();
});
