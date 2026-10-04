import { expect, test, type Page } from '@playwright/test';
import { newPlayerPage } from './support';

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

  await host.goto('/play');
  await host.getByLabel('Your name').fill('Ana');
  await scribble(host);
  await host.getByRole('button', { name: /play/i }).click();
  await host.getByRole('button', { name: /create room/i }).click();
  const code = (await host.getByTestId('room-code').textContent()) ?? '';

  // The guest leaves the pad blank and gets an avatar made from their initial.
  await guest.goto(`/r/${code}`);
  await guest.getByLabel('Your name').fill('Bo');
  await guest.getByRole('button', { name: /join room/i }).click();

  const anaOnGuest = await loadedAvatar(guest, 'Ana');
  const boOnHost = await loadedAvatar(host, 'Bo');
  const anaSrc = await anaOnGuest.getAttribute('src');
  expect(anaSrc).not.toBe(await boOnHost.getAttribute('src'));
  expect(await (await loadedAvatar(host, 'Ana')).getAttribute('src')).toBe(anaSrc);
});
