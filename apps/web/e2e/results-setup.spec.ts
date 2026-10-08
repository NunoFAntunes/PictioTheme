import { expect, test } from '@playwright/test';
import { startTurn } from './support';

/** After a match the host sets up the next one on the waiting room's screen: deck library and rules. */

test('change the deck from the results and play again', async ({ browser }) => {
  const { host } = await startTurn(browser);

  await host.getByRole('button', { name: 'Manage room' }).click();
  await host.getByRole('button', { name: 'End', exact: true }).click();
  await host.getByRole('button', { name: 'Show the results' }).click();
  await expect(host.getByRole('heading', { name: 'Results' })).toBeVisible();

  await host.getByRole('button', { name: 'Change deck & settings' }).click();
  await expect(host.getByRole('heading', { name: /House rules/ })).toBeVisible();
  await host.getByLabel('Search decks').fill('dinosaur');
  const found = host.getByRole('region', { name: 'Results' });
  await found.getByRole('radio').click({ force: true });
  await expect(host.getByTestId('room-deck')).toHaveAttribute('title', /Dinosaur/);

  await host.getByRole('button', { name: '← Back to results' }).click();
  await expect(host.getByRole('heading', { name: 'Results' })).toBeVisible();
  await host.getByRole('button', { name: 'Change deck & settings' }).click();
  await host.getByRole('button', { name: 'Play again ▶' }).click();
  await expect(host.getByText('Choose what to draw')).toBeVisible();
});
