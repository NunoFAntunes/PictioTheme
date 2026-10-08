import { expect, test } from '@playwright/test';
import { canvasHasInk, followInvite, hostRoom, newPlayerPage } from './support';

/** ❤️ likes: the room's most-liked drawing becomes its cover on the home page's room note. */

test('a liked drawing becomes the cover of a public room on the home page', async ({ browser }) => {
  const host = await newPlayerPage(browser);
  const guest = await newPlayerPage(browser);
  const code = await hostRoom(host, 'Ana');
  await host.getByRole('switch', { name: 'Public room' }).click();
  await followInvite(guest, code, 'Bo');
  await expect(host.getByRole('list', { name: 'Players' }).getByText('Bo')).toBeVisible();

  // Ana draws first.
  await host.getByRole('button', { name: /start game/i }).click();
  await host.getByText('Choose what to draw').waitFor();
  await host
    .getByRole('button', { name: /×1|silly/i })
    .first()
    .click();
  await expect(host.getByTestId('current-word')).toBeVisible();
  const box = await host.locator('canvas').boundingBox();
  if (!box) throw new Error('no canvas');
  await host.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.3);
  await host.mouse.down();
  for (let i = 1; i <= 10; i++) {
    await host.mouse.move(box.x + box.width * (0.3 + i * 0.04), box.y + box.height * 0.5);
  }
  await host.mouse.up();
  await expect.poll(() => canvasHasInk(guest)).toBe(true);

  // Bo likes it; the drawer can't like their own, but sees the count.
  await expect(host.getByRole('button', { name: /^Like/ })).toHaveCount(0);
  await guest.getByRole('button', { name: /^Like/ }).click();
  await expect(guest.getByRole('button', { name: /^Liked · 1/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(host.getByText('1 person likes your drawing')).toBeVisible();

  // Skip to the reveal; as it ends, Ana's browser sends the picture.
  await host.getByRole('button', { name: 'Manage room' }).click();
  await host.getByRole('button', { name: 'Skip' }).click();
  await expect
    .poll(async () => (await host.request.get(`/api/rooms/${code}/cover`)).status(), {
      timeout: 15_000,
    })
    .toBe(200);

  const visitor = await newPlayerPage(browser);
  await visitor.goto('/');
  // This room's note (rooms from earlier runs may still be listed with the same name).
  const cover = visitor
    .locator(`a[href="/r/${code}"]`)
    .getByRole('img', { name: "The most-liked drawing in Ana's room" });
  await expect(cover).toBeVisible({ timeout: 10_000 });
  await expect(cover).toHaveClass(/animate-boil/);
});
