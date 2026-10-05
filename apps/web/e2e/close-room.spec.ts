import { expect, test } from '@playwright/test';
import { followInvite, hostRoom, newPlayerPage } from './support';

test('the host closes the room for everyone', async ({ browser }) => {
  const host = await newPlayerPage(browser);
  const guest = await newPlayerPage(browser);
  const code = await hostRoom(host, 'Ana');
  await followInvite(guest, code, 'Bo');
  await expect(host.getByRole('list', { name: 'Players' }).getByText('Bo')).toBeVisible();

  // Only the host has the button.
  await expect(guest.getByRole('button', { name: /close room/i })).toHaveCount(0);
  host.once('dialog', (dialog) => void dialog.accept());
  await host.getByRole('button', { name: /close room/i }).click();

  await expect(host.getByRole('heading', { name: 'You closed the room.' })).toBeVisible();
  await expect(guest.getByRole('heading', { name: 'The host closed this room.' })).toBeVisible();
  // The room is gone: following the invite again doesn't get back in.
  await guest.goto(`/r/${code}`);
  await expect(guest.getByRole('heading', { name: 'The host closed this room.' })).toHaveCount(0);
  await expect(guest.getByRole('link', { name: 'Back to the lobby' })).toBeVisible();
});
