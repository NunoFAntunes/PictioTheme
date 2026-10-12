import { expect } from '@playwright/test';
import { followInvite, hostRoom, newPlayerPage, test } from './support';

/** Emotes: click a character in the margin, pick from the wheel; everyone sees it and the feed says so. */

test('a player slaps another, and both see it in the feed', async ({ browser }) => {
  const host = await newPlayerPage(browser);
  const guest = await newPlayerPage(browser);
  const code = await hostRoom(host, 'Ana');
  await followInvite(guest, code, 'Bo');
  await expect(host.getByRole('list', { name: 'Players' }).getByText('Bo')).toBeVisible();

  // Ana's own character offers solo emotes, and shows all her charges.
  await host.getByRole('button', { name: 'Your emotes' }).click();
  const own = host.getByRole('menu', { name: 'Your emotes' });
  await expect(own.getByRole('menuitem')).toHaveText([/Dance/, /Taunt/, /Flex/, /Cry/]);
  await expect(own.getByRole('img', { name: '3 of 3 emotes left' })).toBeVisible();
  await host.keyboard.press('Escape');
  await expect(own).toHaveCount(0);

  // Bo's character offers the targeted ones.
  await host.getByRole('button', { name: 'Emotes at Bo' }).click();
  const atBo = host.getByRole('menu', { name: 'Emotes at Bo' });
  await expect(atBo.getByRole('menuitem')).toHaveText([/Squish/, /Slap/, /Tomato/, /Hug/]);
  await atBo.getByRole('menuitem', { name: /Slap/ }).click();
  await expect(atBo).toHaveCount(0);

  const feed = (page: typeof host) => page.getByRole('log', { name: 'Guesses and chat' });
  await expect(feed(host)).toContainText('You slapped Bo!');
  await expect(feed(guest)).toContainText('Ana slapped you!');

  // It used one of Ana's charges, and she has to catch her breath before the next one.
  await host.getByRole('button', { name: 'Your emotes' }).click();
  await expect(host.getByRole('img', { name: '2 of 3 emotes left' })).toBeVisible();
  await expect(host.getByRole('menuitem', { name: /Dance/ })).toBeDisabled();
  await expect(host.getByRole('menuitem', { name: /Dance/ })).toBeEnabled({ timeout: 5_000 });
  await host.getByRole('menuitem', { name: /Dance/ }).click();
  await expect(feed(guest)).toContainText('Ana busted a move!');

  // Charges come back while the page stays open (20 s after the first emote), no reload needed.
  await host.getByRole('button', { name: 'Your emotes' }).click();
  await expect(host.getByRole('img', { name: '1 of 3 emotes left' })).toBeVisible();
  await expect(host.getByRole('img', { name: '2 of 3 emotes left' })).toBeVisible({
    timeout: 25_000,
  });
});
