import { expect, test } from '@playwright/test';
import { followInvite, hostRoom, newPlayerPage, startTurn } from './support';

test('players waiting for the host get toys around the house rules; the host gets the deck library', async ({
  browser,
}) => {
  const host = await newPlayerPage(browser, { viewport: { width: 1440, height: 900 } });
  const guest = await newPlayerPage(browser, { viewport: { width: 1440, height: 900 } });
  const code = await hostRoom(host, 'Ana');
  await followInvite(guest, code, 'Bo');

  await expect(guest.getByText('Waiting for the host to start')).toBeVisible();
  await guest.getByRole('button', { name: 'Not now' }).click();
  await expect(guest.getByTestId('toys-around')).toBeVisible();
  await expect(host.getByTestId('toys-around')).toHaveCount(0);

  // The stamp hops, thumps and leaves a mark.
  await guest.getByTestId('toy-stamp').click();
  await expect(guest.getByTestId('stamp-mark')).toHaveCount(1);

  // The fortune teller is worked a few times, then tells a fortune.
  await guest.getByTestId('toy-fortune-teller').click();
  await expect(guest.getByTestId('fortune')).toBeVisible({ timeout: 4000 });

  // The pencil spins to point somewhere new.
  const pencil = guest.getByTestId('toy-pencil');
  const before = Number(await pencil.getAttribute('data-turn'));
  await pencil.click({ force: true });
  await expect
    .poll(async () => Number(await pencil.getAttribute('data-turn')))
    .toBeGreaterThan(before + 500);
});

test('players who aren’t the host get the toys back on the results', async ({ browser }) => {
  const { host, guest } = await startTurn(browser);

  await host.getByRole('button', { name: 'Manage room' }).click();
  await host.getByRole('button', { name: 'End', exact: true }).click();
  await host.getByRole('button', { name: 'Show the results' }).click();
  await expect(guest.getByRole('heading', { name: 'Results' })).toBeVisible();

  await expect(guest.getByTestId('toys-around')).toBeVisible();
  await expect(host.getByTestId('toys-around')).toHaveCount(0);
  await guest.getByTestId('toy-stamp').click();
  await expect(guest.getByTestId('stamp-mark')).toHaveCount(1);
});
