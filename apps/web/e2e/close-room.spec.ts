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
  // It asks first, on a note; "Keep it open" puts the note away.
  await host.getByRole('button', { name: /close room/i }).click();
  const note = host.getByRole('alertdialog', { name: 'Close the room?' });
  await note.getByRole('button', { name: 'Keep it open' }).click();
  await expect(note).toHaveCount(0);
  await host.getByRole('button', { name: /close room/i }).click();
  await note.getByRole('button', { name: /crumple it up/i }).click();

  // The room is crumpled into a ball and kicked away, and the host is back home.
  await expect(host).toHaveURL(/\/$/);
  await expect(guest.getByRole('heading', { name: 'The host closed this room.' })).toBeVisible();
  // The room is gone: following the invite again doesn't get back in.
  await guest.goto(`/r/${code}`);
  await expect(guest.getByRole('heading', { name: 'The host closed this room.' })).toHaveCount(0);
  await expect(guest.getByRole('link', { name: 'Back to the lobby' })).toBeVisible();
});
