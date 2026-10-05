import { expect, test, type Page } from '@playwright/test';
import { newPlayerPage } from './support';

/** The landing hero: the logo is a toy (grab, fling, springs home) and the CTA leads to the lobby. */

async function centreOf(page: Page, index: number) {
  const box = await page.getByTestId('logo-letter').nth(index).boundingBox();
  if (!box) throw new Error('letter not visible');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/**
 * How far a letter sits from its home spot. Measured against its wrapper (which physics never
 * moves) rather than the page: the hero is centred, so the lobby below it loading or listing other
 * tests' public rooms shifts the whole logo.
 */
async function offsetFromHome(page: Page, index: number) {
  return page
    .getByTestId('logo-letter')
    .nth(index)
    .evaluate((el) => {
      const home = el.parentElement?.getBoundingClientRect();
      if (!home) throw new Error('letter has no wrapper');
      const now = el.getBoundingClientRect();
      return Math.hypot(now.x - home.x, now.y - home.y);
    });
}

async function waitForIntro(page: Page) {
  await page
    .locator('astro-island[component-url*="HeroLogo"]:not([ssr])')
    .waitFor({ state: 'attached' });
  await page.waitForTimeout(2500);
}

test('shows the logo and gives a first-time visitor a silly name, no form', async ({ browser }) => {
  const page = await newPlayerPage(browser);
  await page.goto('/');
  await expect(page).toHaveTitle(/^DoodleWhirl!/);
  await expect(page.getByRole('heading', { level: 1, name: 'DoodleWhirl!' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: /^Playing as [A-Z][a-z]+ [A-Z][a-z]+/ }),
  ).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Your name', exact: true })).toBeHidden();
});

test('quick play goes straight into a public room', async ({ browser }) => {
  const page = await newPlayerPage(browser);
  await page.goto('/');
  await page.getByRole('button', { name: /quick play/i }).click();
  await expect(page).toHaveURL(/\/r\/[A-Z]{3}-[A-Z]{3}$/);
  await expect(page.getByTestId('room-code')).toBeVisible();
  await expect(page.getByText(/public room/i)).toBeVisible();
});

test('a new private room takes one click, and a friend joins by pasting the link', async ({
  browser,
}) => {
  const host = await newPlayerPage(browser);
  await host.goto('/');
  await host.getByRole('button', { name: /new private room/i }).click();
  await expect(host).toHaveURL(/\/r\/[A-Z]{3}-[A-Z]{3}$/);
  await expect(host.getByText(/private room/i)).toBeVisible();
  const link = host.url();

  const friend = await newPlayerPage(browser);
  await friend.goto('/');
  const chip = friend.getByRole('button', { name: /^Playing as/ });
  const friendName = ((await chip.textContent()) ?? '')
    .replace('Playing as', '')
    .replace('✏️', '')
    .trim();
  await friend.getByLabel('Join with a code').fill(link);
  await friend.getByRole('button', { name: 'Join' }).click();
  await expect(friend).toHaveURL(link);
  await expect(host.getByRole('list', { name: 'Players' }).getByText(friendName)).toBeVisible();
});

test('a code with no room says so on the home page instead of leaving it', async ({ browser }) => {
  const page = await newPlayerPage(browser);
  await page.goto('/');
  await page.getByLabel('Join with a code').fill('ZZZ-ZZZ');
  await page.getByRole('button', { name: 'Join' }).click();
  await expect(page.getByRole('alert')).toHaveText(/no room with that code/i);
  await expect(page).toHaveURL(/\/$/);
});

test('the host renames a private room and makes it public, and it shows on the home page', async ({
  browser,
}) => {
  const host = await newPlayerPage(browser);
  await host.goto('/');
  await host.getByRole('button', { name: /new private room/i }).click();
  await expect(host.getByTestId('room-code')).toHaveText(/^[A-Z]{3}-[A-Z]{3}$/);

  await host.getByRole('button', { name: 'Rename the room' }).click();
  await host.getByLabel('Room name').fill('Spooky Scribblers');
  await host.getByLabel('Room name').press('Enter');
  await host.getByRole('switch', { name: 'Public room' }).click();
  await expect(host.getByText(/public room · share this code/i)).toBeVisible();
  await expect(host.getByRole('heading', { name: 'Spooky Scribblers' })).toBeVisible();

  const visitor = await newPlayerPage(browser);
  await visitor.goto('/');
  await expect(visitor.getByRole('link', { name: /^Join Spooky Scribblers/ })).toBeVisible({
    timeout: 10_000,
  });
});

test('a letter can be dragged away and springs back home', async ({ browser }) => {
  const page = await newPlayerPage(browser, { viewport: { width: 1280, height: 800 } });
  await page.goto('/');
  await waitForIntro(page);
  const home = await centreOf(page, 3);

  await page.mouse.move(home.x, home.y);
  await page.mouse.down();
  await page.mouse.move(home.x + 120, home.y + 180, { steps: 10 });
  expect(await offsetFromHome(page, 3)).toBeGreaterThan(100);

  await page.mouse.up();
  await expect.poll(() => offsetFromHome(page, 3)).toBeLessThan(1);
});

test('with reduced motion the logo stays put', async ({ browser }) => {
  const page = await newPlayerPage(browser, {
    viewport: { width: 1280, height: 800 },
    reducedMotion: 'reduce',
  });
  await page.goto('/');
  await page
    .locator('astro-island[component-url*="HeroLogo"]:not([ssr])')
    .waitFor({ state: 'attached' });
  const home = await centreOf(page, 3);
  await page.mouse.move(home.x, home.y);
  await page.mouse.down();
  await page.mouse.move(home.x + 120, home.y + 180, { steps: 10 });
  const after = await offsetFromHome(page, 3);
  await page.mouse.up();
  expect(after).toBeLessThan(1);
});

test('the things on the desk are toys: the eraser leaves crumbs, a crayon scribbles', async ({
  browser,
}) => {
  const page = await newPlayerPage(browser, { viewport: { width: 1440, height: 900 } });
  await page.goto('/');
  await page
    .locator('astro-island[component-url*="DeskProps"]:not([ssr])')
    .waitFor({ state: 'attached' });

  const crumbs = page.getByTestId('eraser-crumb');
  const before = await crumbs.count();
  await page.getByTestId('desk-eraser').click();
  await expect.poll(() => crumbs.count()).toBeGreaterThan(before);

  // The crayon's inner end is under the paper: click near its tip, out on the desk.
  const crayon = page.getByTestId('desk-crayon').first();
  const box = await crayon.boundingBox();
  if (!box) throw new Error('crayon not visible');
  await crayon.click({ position: { x: box.width * 0.85, y: box.height / 2 } });
  await expect(page.getByTestId('crayon-scribble')).toHaveCount(1);
});
