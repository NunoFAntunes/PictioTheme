import { devices, expect, test } from '@playwright/test';

/** Phones get a "bigger screen" page instead of the app; tablets go straight in. */

test('a phone sees the bigger-screen page, with the link to open elsewhere', async ({
  browser,
}) => {
  const phone = await (await browser.newContext({ ...devices['iPhone 15'] })).newPage();
  await phone.goto('/r/ABC-DEF');
  await expect(
    phone.getByRole('heading', { name: 'PictioTheme needs a bigger screen' }),
  ).toBeVisible();
  await expect(phone.getByText('/r/ABC-DEF')).toBeVisible();

  await phone.getByRole('button', { name: 'Try anyway' }).click();
  await expect(
    phone.getByRole('heading', { name: 'PictioTheme needs a bigger screen' }),
  ).toHaveCount(0);
});

test('a tablet goes straight to the app', async ({ browser }) => {
  const tablet = await (await browser.newContext({ ...devices['iPad Mini'] })).newPage();
  await tablet.goto('/play');
  await expect(tablet.getByLabel('Your name')).toBeVisible();
});
