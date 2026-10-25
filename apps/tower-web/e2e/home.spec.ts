import { expect, test } from '@playwright/test';

/**
 * The home page's toys: the logo's balloons pop and come back, picking a way in without a name
 * opens the "you" sticker's editor, and a drawn avatar replaces the bobble hat and is remembered.
 * No backend needed. `SCREENSHOTS=<dir>` saves a picture of the page.
 */

test('the logo, the name nudge and drawing yourself', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Doodle Tower' })).toBeVisible();

  // Pop an O: it's gone, then blows up again.
  const balloon = page.getByTestId('logo-balloon').first();
  await balloon.dispatchEvent('pointerdown');
  await expect(balloon).toHaveAttribute('data-state', 'popped');
  await expect(balloon).toHaveAttribute('data-state', 'whole', { timeout: 5000 });

  // No name yet: the sticker asks for one, and picking a way in opens its editor.
  const sticker = page.getByRole('button', { name: 'Name yourself and draw yourself' });
  await expect(sticker).toHaveAccessibleDescription(/Introduce yourself/);
  await page.getByRole('button', { name: 'Create a lobby' }).click();
  await expect(page).toHaveURL('/');
  const dialog = page.getByRole('dialog', { name: 'Your name and drawing' });
  await expect(dialog.getByRole('textbox', { name: 'Your name', exact: true })).toBeFocused();

  // Name yourself and draw a face.
  await dialog.getByRole('textbox', { name: 'Your name', exact: true }).fill('Ana');
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
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toBeHidden();
  const named = page.getByRole('button', { name: /^Playing as Ana/ });
  await expect(named).toBeVisible();
  const drawn = await named.locator('img').getAttribute('src');

  // Remembered after a reload.
  const dir = process.env.SCREENSHOTS;
  if (dir) await page.screenshot({ path: `${dir}/home.png` });
  await page.reload();
  await expect(named.locator('img')).toHaveAttribute('src', drawn ?? '');
});

test('how to play, a page at a time', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'How to play', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'How to play' });
  const title = dialog.getByRole('heading', { level: 3 });
  await expect(title).toHaveText('Two crews, two towers');
  await expect(dialog.getByRole('button', { name: '← Back' })).toBeDisabled();
  // With reduced motion (as these tests run) the pictures hold still: nothing to pause.
  await expect(dialog.getByRole('button', { name: /the picture/ })).toHaveCount(0);

  // Next, or the arrow keys.
  await dialog.getByRole('button', { name: 'Next →' }).click();
  await expect(title).toHaveText('Your drawing is the block');
  await page.keyboard.press('ArrowRight');
  await expect(title).toHaveText('Guess it');
  await page.keyboard.press('ArrowLeft');
  await expect(title).toHaveText('Your drawing is the block');

  // Jump to a section: the powers list every curse and spell.
  await dialog.getByRole('button', { name: 'Powers' }).click();
  await expect(title).toHaveText('Curses');
  await expect(dialog.getByText('Slippery', { exact: true })).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await expect(dialog.getByText('Magpie', { exact: true })).toBeVisible();

  // The last page sends you off to play; it opens at the start again.
  await dialog.getByRole('button', { name: 'Getting spells' }).click();
  await dialog.getByRole('button', { name: 'Let’s play!' }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole('button', { name: 'How to play', exact: true }).click();
  await expect(title).toHaveText('Two crews, two towers');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test("the guide's pictures play, and pause", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'no-preference' });
  const page = await context.newPage();
  await page.goto('/');
  await page.getByRole('button', { name: 'How to play', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'How to play' });
  const picture = dialog.locator('canvas').first();
  const frame = async () => (await picture.screenshot()).toString('base64');

  // It moves…
  const before = await frame();
  await expect.poll(frame).not.toBe(before);

  // …until it's paused, and again once it plays.
  await dialog.getByRole('button', { name: 'Pause the picture' }).click();
  const held = await frame();
  await page.waitForTimeout(400);
  expect(await frame()).toBe(held);
  await dialog.getByRole('button', { name: 'Play the picture' }).click();
  await expect.poll(frame).not.toBe(held);
  await context.close();
});

test('the powers pages tour the curses, or show the one picked', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'no-preference' });
  const page = await context.newPage();
  await page.clock.install();
  await page.goto('/');
  await page.getByRole('button', { name: 'How to play', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'How to play' });
  await dialog.getByRole('button', { name: 'Powers' }).click();
  const curses = dialog.getByRole('list', { name: 'Curses' });
  const showing = curses.getByRole('button', { pressed: true });

  // Left alone, it shows each curse in turn, a loop each.
  await expect(showing).toHaveAccessibleName(/^Slippery /);
  await page.clock.runFor(5_400);
  await expect(showing).toHaveAccessibleName(/^Big ice /);

  // Picked, it stays on that one.
  await curses.getByRole('button', { name: /^Melt / }).click();
  await expect(showing).toHaveAccessibleName(/^Melt /);
  await page.clock.runFor(14_000);
  await expect(showing).toHaveAccessibleName(/^Melt /);

  // The spells page lists every spell the same way.
  await dialog.getByRole('button', { name: 'Next →' }).click();
  await expect(dialog.getByRole('list', { name: 'Spells' }).getByRole('button')).toHaveCount(4);
  await context.close();
});

test('the guide opens by itself on the first visit, and only then', async ({ page }) => {
  // The tests' browsers have already "seen" it (playwright.config.ts): forget that.
  await page.goto('/');
  await page.evaluate(() => localStorage.removeItem('doodletower.seen-how-to-play'));
  await page.reload();
  const dialog = page.getByRole('dialog', { name: 'How to play' });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await page.reload();
  await expect(page.getByRole('button', { name: 'How to play', exact: true })).toBeVisible();
  await expect(dialog).toBeHidden();
});

test('the under-construction sign, and its tower that comes down', async ({ page }) => {
  await page.goto('/');
  const sign = page.getByRole('complementary', { name: 'Under construction' });
  await expect(sign).toContainText('still being built');
  await sign.getByRole('button', { name: 'Knock the tower over' }).click();
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
