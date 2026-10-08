import { expect, test, type Page } from '@playwright/test';
import { followInvite, nameOnHome, newPlayerPage, startTurn } from './support';

/** Drawn avatars: draw on the pad, and everyone in the room sees the image. */

async function scribble(page: Page) {
  const box = await page.getByLabel('Avatar drawing pad').boundingBox();
  if (!box) throw new Error('no avatar pad');
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.5);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) {
    await page.mouse.move(box.x + box.width * (0.2 + i * 0.06), box.y + box.height * 0.5);
  }
  await page.mouse.up();
}

/** The avatar <img> in the player list for `name`, once it has loaded from the server. */
async function loadedAvatar(page: Page, name: string) {
  const img = page.getByRole('list', { name: 'Players' }).getByAltText(`${name}'s avatar`);
  await expect(img).toHaveAttribute('src', /^\/api\/avatars\/[0-9a-f]{32}$/);
  await expect
    .poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth))
    .toBe(128);
  return img;
}

test('a drawn avatar shows in the player list for everyone', async ({ browser }) => {
  const host = await newPlayerPage(browser);
  const guest = await newPlayerPage(browser);

  await nameOnHome(host, 'Ana', scribble);
  // Ana drew a face, so the arrow asking for one is gone.
  await expect(host.getByTestId('introduce-yourself')).toHaveCount(0);
  await host.getByRole('button', { name: /new private room/i }).click();
  await expect(host.getByTestId('room-code')).toHaveText(/^[A-Z]{3}-[A-Z]{3}$/);
  const code = (await host.getByTestId('room-code').textContent()) ?? '';

  // The guest never draws and keeps the avatar made from their initial.
  await followInvite(guest, code, 'Bo');

  const anaOnGuest = await loadedAvatar(guest, 'Ana');
  const boOnHost = await loadedAvatar(host, 'Bo');
  const anaSrc = await anaOnGuest.getAttribute('src');
  expect(anaSrc).not.toBe(await boOnHost.getAttribute('src'));
  expect(await (await loadedAvatar(host, 'Ana')).getAttribute('src')).toBe(anaSrc);
});

test('a player who never drew draws themselves in the waiting room, and the room updates', async ({
  browser,
}) => {
  const host = await newPlayerPage(browser);
  const guest = await newPlayerPage(browser);
  await nameOnHome(host, 'Ana', scribble);
  await host.getByRole('button', { name: /new private room/i }).click();
  await expect(host.getByTestId('room-code')).toHaveText(/^[A-Z]{3}-[A-Z]{3}$/);
  const code = (await host.getByTestId('room-code').textContent()) ?? '';

  // Straight from the invite link, with a generated name and initial.
  await guest.goto(`/r/${code}`);
  await expect(guest.getByRole('heading', { name: /Draw yourself/ })).toBeVisible();
  const before = await loadedAvatar(host, (await playerNames(host)).find((n) => n !== 'Ana') ?? '');
  const beforeSrc = await before.getAttribute('src');

  await guest.getByRole('textbox', { name: 'Your name', exact: true }).fill('Bo');
  await scribble(guest);
  await guest.getByRole('button', { name: 'Save' }).click();
  await expect(guest.getByRole('heading', { name: /Draw yourself/ })).toHaveCount(0);

  // The host sees the new name and drawing, without the guest reconnecting.
  const after = await loadedAvatar(host, 'Bo');
  expect(await after.getAttribute('src')).not.toBe(beforeSrc);
});

test('mid-match, a player renames themselves from the room header', async ({ browser }) => {
  const { host, guest } = await startTurn(browser); // Ana draws, Bo guesses
  await guest.getByRole('button', { name: /^Playing as Bo: change name or drawing/ }).click();
  await guest.getByRole('textbox', { name: 'Your name', exact: true }).fill('Bobby');
  await guest.getByRole('button', { name: 'Save' }).click();
  // Mid-match the list is the leaderboard, inside the Players margin.
  await expect(
    host.getByRole('complementary', { name: 'Players' }).getByText('Bobby'),
  ).toBeVisible();
  // The turn carries on: nobody reconnected.
  await expect(host.getByTestId('current-word')).toBeVisible();
});

/** Names in the player list, read from the avatars' alt text ("Bo's avatar"). */
async function playerNames(page: Page): Promise<string[]> {
  const list = page.getByRole('list', { name: 'Players' });
  await expect(list.getByRole('img')).toHaveCount(2);
  const alts = await list
    .getByRole('img')
    .evaluateAll((imgs) => imgs.map((img) => img.getAttribute('alt') ?? ''));
  return alts.map((alt) => alt.replace(/'s avatar$/, ''));
}
