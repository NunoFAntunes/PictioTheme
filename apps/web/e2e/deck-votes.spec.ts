import { expect } from '@playwright/test';
import { followInvite, hostRoom, newPlayerPage, test } from './support';

/** Players vote for the next deck: a paddle beside their doodle, which the host can play. */

test('a player votes for a deck and the host plays it', async ({ browser }) => {
  const host = await newPlayerPage(browser);
  const guest = await newPlayerPage(browser);
  const code = await hostRoom(host, 'Ana');
  await followInvite(guest, code, 'Bo');
  await expect(host.getByRole('list', { name: 'Players' }).getByText('Bo')).toBeVisible();

  // The host picks the deck, so only the others vote.
  await expect(host.getByRole('button', { name: /Vote for the next deck/ })).toHaveCount(0);
  await guest.getByRole('button', { name: /Vote for the next deck/ }).click();
  const sheet = guest.getByRole('dialog', { name: 'Vote for the next deck!' });
  await sheet.getByLabel('Search decks').fill('inventions');
  await sheet.getByRole('region', { name: 'Results' }).getByRole('radio').click({ force: true });
  await expect(sheet).toBeHidden();

  const paddle = /Bo votes for Inventions Nobody Asked For/;
  await expect(guest.getByRole('img', { name: paddle })).toBeVisible();
  await expect(guest.getByRole('button', { name: 'Change my deck vote' })).toBeVisible();
  await expect(host.getByTestId('deck-vote-tally')).toContainText('1 vote');

  // The host plays it straight from Bo's paddle.
  await host.getByRole('button', { name: paddle }).click();
  await expect(host.getByTestId('room-deck')).toHaveAttribute(
    'title',
    /Inventions Nobody Asked For/,
  );
  await expect(guest.getByRole('img', { name: /\(playing\)$/ })).toBeVisible();

  // The votes were for this match: starting it puts the paddles down.
  await host.getByRole('button', { name: /start game/i }).click();
  await expect(guest.getByRole('img', { name: paddle })).toHaveCount(0);
});
