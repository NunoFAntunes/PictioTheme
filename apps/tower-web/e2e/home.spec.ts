import { expect, test } from '@playwright/test';

/**
 * The home page's toys: the logo's balloons pop and come back, picking a way in without a name
 * points at the name, and a drawn avatar replaces the bobble hat and is remembered. No backend
 * needed. `SCREENSHOTS=<dir>` saves a picture of the page.
 */

test('the logo, the name nudge and drawing yourself', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Doodle Tower' })).toBeVisible();

  // Pop an O: it's gone, then blows up again.
  const balloon = page.getByTestId('logo-balloon').first();
  await balloon.dispatchEvent('pointerdown');
  await expect(balloon).toHaveAttribute('data-state', 'popped');
  await expect(balloon).toHaveAttribute('data-state', 'whole', { timeout: 5000 });

  // No name yet: picking a way in stays here and points at the name.
  await page.getByRole('button', { name: 'Create a lobby' }).click();
  await expect(page).toHaveURL('/');
  await expect(page.getByLabel('Your name')).toBeFocused();

  // Draw a face and keep it.
  await expect(page.getByRole('img', { name: 'Your bobble hat' })).toBeVisible();
  await page.getByRole('button', { name: /Draw yourself/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Draw yourself!' });
  await dialog.getByRole('button', { name: 'That’s me!' }).click();
  await expect(dialog.getByText('Draw something first!')).toBeVisible();
  const pad = await dialog.getByLabel('Avatar drawing pad').boundingBox();
  if (!pad) throw new Error('no pad');
  const cx = pad.x + pad.width / 2;
  const cy = pad.y + pad.height / 2;
  await page.mouse.move(cx + 90, cy);
  await page.mouse.down();
  for (let a = 0; a <= 64; a++) {
    await page.mouse.move(cx + 90 * Math.cos(a / 10), cy + 90 * Math.sin(a / 10));
  }
  await page.mouse.up();
  await dialog.getByRole('button', { name: 'That’s me!' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('img', { name: 'Your drawing' })).toBeVisible();

  // Remembered after a reload.
  await page.getByLabel('Your name').fill('Ana');
  const dir = process.env.SCREENSHOTS;
  if (dir) await page.screenshot({ path: `${dir}/home.png` });
  await page.reload();
  await expect(page.getByRole('img', { name: 'Your drawing' })).toBeVisible();

  // Back to the hat.
  await page.getByRole('button', { name: 'Use the hat' }).click();
  await expect(page.getByRole('img', { name: 'Your bobble hat' })).toBeVisible();
});

test('private game turns round to take a code', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Private game' }).click();
  const field = page.getByLabel('Room code or invite link');
  await expect(field).toBeFocused();
  await field.fill('https://example.com/r/abc-def');
  await expect(field).toHaveValue('ABC-DEF');
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByRole('button', { name: 'Private game' })).toBeVisible();
});

test("the menu's balloons pop, and come back (with reduced motion, nothing falls)", async ({
  page,
}) => {
  await page.goto('/');
  const balloons = page.getByTestId('menu-balloon');
  await expect(balloons).toHaveCount(6);
  while ((await balloons.count()) > 0) await balloons.first().dispatchEvent('pointerdown');
  await expect(balloons).toHaveCount(6, { timeout: 5000 });
  await expect(page.getByRole('button', { name: 'Quick game' })).toBeEnabled();
});
