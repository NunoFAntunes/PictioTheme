import { expect } from '@playwright/test';
import { DRAWER, followInvite, hostRoom, newPlayerPage, test } from './support';

/** Rush mode: the first correct guess starts a draining bar for everyone (game-rules.md#rush). */

test('the first correct guess starts the rush meter', async ({ browser }) => {
  const host = await newPlayerPage(browser, DRAWER);
  const bo = await newPlayerPage(browser);
  const cy = await newPlayerPage(browser);

  const code = await hostRoom(host, 'Ana');
  // The Standard game plays with rush.
  await host.getByRole('radio', { name: /Standard game/ }).click();
  await expect(host.getByRole('radio', { name: /Standard game/ })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await followInvite(bo, code, 'Bo');
  await followInvite(cy, code, 'Cy');
  await expect(host.getByRole('list', { name: 'Players' }).getByText('Cy')).toBeVisible();

  await host.getByRole('button', { name: /start game/i }).click();
  await host.getByText('Choose what to draw').waitFor();
  await host.getByRole('button', { name: /×1/ }).first().click();
  const word =
    (await host.getByTestId('current-word').textContent())?.replace('✏️', '').trim() ?? '';

  await expect(cy.getByTestId('rush-meter')).toHaveCount(0);
  const input = bo.getByPlaceholder('Type your guess…');
  await input.fill(word.toLowerCase());
  await input.press('Enter');

  // Cy hasn't guessed: the bar, what a guess is worth now, and the feed line.
  const meter = cy.getByTestId('rush-meter');
  await expect(meter).toBeVisible();
  await expect(meter.getByText(/^\+\d+$/)).toBeVisible();
  await expect(cy.getByRole('log').getByText(/Rush! \d+ seconds left to guess/)).toBeVisible();
  // The drawer and Bo see the bar without points.
  await expect(host.getByTestId('rush-meter')).toBeVisible();
  await expect(bo.getByTestId('rush-meter').getByText(/^\+\d+$/)).toHaveCount(0);
});
