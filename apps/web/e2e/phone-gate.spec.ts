import { devices, expect, test } from '@playwright/test';

/** Phones get a "bigger screen" page instead of the app; tablets go straight in. */

test('a phone sees the bigger-screen page, with the link to open elsewhere', async ({
  browser,
}) => {
  const phone = await (await browser.newContext({ ...devices['iPhone 15'] })).newPage();
  await phone.goto('/r/ABC-DEF');
  await expect(
    phone.getByRole('heading', { name: 'DoodleWhirl! needs a bigger screen' }),
  ).toBeVisible();
  await expect(phone.getByText('/r/ABC-DEF')).toBeVisible();

  await phone.getByRole('button', { name: 'Try anyway' }).click();
  await expect(
    phone.getByRole('heading', { name: 'DoodleWhirl! needs a bigger screen' }),
  ).toHaveCount(0);
});

test('a tablet gets the ways in on the home page; a phone gets a note instead', async ({
  browser,
}) => {
  const tablet = await (await browser.newContext({ ...devices['iPad Mini'] })).newPage();
  await tablet.goto('/');
  await expect(tablet.getByRole('button', { name: /quick play/i })).toBeVisible();

  const phone = await (await browser.newContext({ ...devices['iPhone 15'] })).newPage();
  await phone.goto('/');
  await expect(phone.getByText(/open this page on a tablet or a computer/i)).toBeVisible();
  await expect(phone.getByRole('button', { name: /quick play/i })).toHaveCount(0);
  await phone.getByRole('button', { name: 'Show me anyway' }).click();
  await expect(phone.getByRole('button', { name: /quick play/i })).toBeVisible();
});

test('the old lobby address leads to the home page', async ({ page }) => {
  await page.goto('/play');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('button', { name: /quick play/i })).toBeVisible();
});
