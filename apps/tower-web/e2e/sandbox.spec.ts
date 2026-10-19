import { expect, test, type Page } from '@playwright/test';

/**
 * The Phase 0 sandbox end to end: draw on the board, see the block, build it, drop it from the
 * crane, and watch the tower grow. `SCREENSHOTS=<dir>` saves pictures of each stage.
 */

const shot = async (page: Page, name: string) => {
  const dir = process.env.SCREENSHOTS;
  if (dir) await page.screenshot({ path: `${dir}/${name}.png` });
};

/** Draws a closed rectangle with the mouse, in fractions of the board. */
async function drawRectangle(page: Page, [x0, y0, x1, y1]: [number, number, number, number]) {
  const board = page.getByLabel('Drawing canvas');
  const box = await board.boundingBox();
  if (!box) throw new Error('no board');
  const at = (fx: number, fy: number) => [box.x + box.width * fx, box.y + box.height * fy] as const;
  await page.mouse.move(...at(x0, y0));
  await page.mouse.down();
  for (const [fx, fy] of [
    [x1, y0],
    [x1, y1],
    [x0, y1],
    [x0, y0 + 0.01],
  ] as const) {
    await page.mouse.move(...at(fx, fy), { steps: 12 });
  }
  await page.mouse.up();
}

const stat = (page: Page, label: string) => page.getByTestId(`stat-${label.toLowerCase()}`);

test('draw a block, build it, drop it on the tower', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/sandbox');
  await expect(page.getByText('Raising the crane…')).toHaveCount(0, { timeout: 20_000 });
  await expect(page.getByText('Draw something to see its block')).toBeVisible();
  await shot(page, '1-empty');

  await drawRectangle(page, [0.25, 0.35, 0.75, 0.65]);
  await expect(page.getByText(/4 corners · 1 part/)).toBeVisible();
  await shot(page, '2-drawn');

  await page.getByRole('button', { name: 'Build it' }).click();
  await expect(page.getByText('Draw something to see its block')).toBeVisible();
  await expect(page.getByText('Placing')).toBeVisible();
  await shot(page, '3-placing');

  await page.keyboard.press('Space');
  await expect(stat(page, 'Placed')).toContainText('1', { timeout: 10_000 });
  await expect(page.getByText('Placing')).toHaveCount(0);
  // The brick settles on the platform: the tower now has a height.
  await expect(stat(page, 'Height')).not.toContainText('0.0 /', { timeout: 10_000 });
  await shot(page, '4-placed');
});

test('queue samples from the workbench and let them stack', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/sandbox');
  await expect(page.getByText('Raising the crane…')).toHaveCount(0, { timeout: 20_000 });
  await page.getByRole('button', { name: 'Workbench' }).click();
  await shot(page, '5-workbench');
  for (const word of ['brick', 'boot', 'house', 'mountain', 'lightbulb']) {
    await page.getByRole('button', { name: word, exact: true }).click();
  }
  await page.getByRole('button', { name: 'Close the workbench' }).click();
  // Drop each one as it arrives, nudging them around the platform.
  for (let i = 0; i < 5; i++) {
    await expect(page.getByText('Placing')).toBeVisible({ timeout: 15_000 });
    await page.keyboard.down(i % 2 ? 'ArrowLeft' : 'ArrowRight');
    await page.waitForTimeout(250);
    await page.keyboard.up(i % 2 ? 'ArrowLeft' : 'ArrowRight');
    if (i === 2) await page.keyboard.press('KeyQ');
    await page.keyboard.press('Space');
    await expect(stat(page, 'Placed')).toContainText(String(i + 1), { timeout: 10_000 });
  }
  await page.waitForTimeout(2500);
  await shot(page, '6-stack');
  await page.getByRole('button', { name: 'Workbench' }).click();
  await page.getByLabel('Show colliders').check();
  await page.getByRole('button', { name: 'Close the workbench' }).click();
  await shot(page, '7-colliders');
});
