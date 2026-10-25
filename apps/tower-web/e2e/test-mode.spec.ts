import { expect, test, type Page } from '@playwright/test';
import { nameYourself } from './support';

/**
 * Test mode (docs/tower/planning/test-mode.md), alone against the bots: "Guess ours" instead of
 * typing a word, keep and place the rectangle, then the rival curses one at you and casts a Fog.
 * Needs the API server (TOWER_API_PORT, default 3000) with test mode on (it is outside
 * production). `SCREENSHOTS=<dir>` saves pictures of each stage.
 */

const shot = async (page: Page, name: string) => {
  const dir = process.env.SCREENSHOTS;
  if (dir) await page.screenshot({ path: `${dir}/test-mode-${name}.png` });
};

test('test mode: one player tries curses and spells against the bots', async ({ browser }) => {
  test.setTimeout(90_000);
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto('/');
  await nameYourself(page, 'Tess');
  await page.getByRole('button', { name: '🧪 Test the powers' }).click();
  await expect(page.getByText('🧪 Test mode')).toBeVisible();
  await page.getByRole('button', { name: 'Start building' }).click();

  // The bots have drawn a rectangle for each crew.
  const guess = page.getByRole('button', { name: '✅ Guess ours' });
  await expect(guess).toBeEnabled();
  await shot(page, '1-start');

  // Pick the curse, solve our drawing, and keep it: we place it.
  await page.getByRole('button', { name: '🫠 Melt' }).click();
  await guess.click();
  const decide = page.getByRole('dialog', { name: 'Keep or curse' });
  await expect(decide).toBeVisible();
  await expect(decide).toContainText('Melt');
  await shot(page, '2-decide');
  await decide.getByRole('button', { name: /Keep/ }).click();
  await expect(page.getByRole('button', { name: 'Drop', disabled: false })).toBeVisible();
  await page.getByRole('button', { name: 'Drop' }).click();
  await expect(page.getByRole('button', { name: 'Drop', disabled: false })).toHaveCount(0, {
    timeout: 10_000,
  });

  // The rival curses a piece at us: our turn to place it.
  await page.getByRole('button', { name: '🏀 Bouncy' }).click();
  await page.getByRole('button', { name: 'Solve theirs, curse at you' }).click();
  await expect(page.getByRole('button', { name: 'Drop', disabled: false })).toBeVisible();
  await shot(page, '3-cursed-at-you');
  await page.getByRole('button', { name: 'Drop' }).click();

  // Give the rival a Fog, and it casts it at us.
  const panel = page.getByRole('complementary', { name: 'Test panel' });
  await panel.getByRole('button', { name: 'Give Teal Fog' }).click();
  await panel.getByRole('button', { name: '🌫️ Fog', exact: true }).click();
  await expect(page.getByText('Teal buildbot is casting Fog!').first()).toBeVisible();
  await page.waitForTimeout(2_500);
  await shot(page, '4-fog');

  // The checklist ticks and remembers.
  await page.getByRole('tab', { name: /Checklist/ }).click();
  await page.getByLabel(/decide card shows the rolled curse/).check();
  await expect(page.getByRole('tab', { name: /Checklist 1\// })).toBeVisible();
  await shot(page, '5-checklist');
  await context.close();
});
