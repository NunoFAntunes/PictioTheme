import { expect, test, type Page } from '@playwright/test';

/**
 * The Phase 0 sandbox end to end: draw on the board, see the block, build it, drop it from the
 * balloons, and watch the tower grow. `SCREENSHOTS=<dir>` saves pictures of each stage.
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
  await expect(page.getByText('Getting ready…')).toHaveCount(0, { timeout: 20_000 });
  await expect(page.getByText('Draw something to see its block')).toBeVisible();
  await shot(page, '1-empty');

  await drawRectangle(page, [0.25, 0.35, 0.75, 0.65]);
  await expect(page.getByText(/4 corners · 1 part/)).toBeVisible();
  // Closing it offers colours to fill it with.
  await page.getByRole('button', { name: 'Fill with Blue' }).click();
  await expect
    .poll(() =>
      page
        .getByLabel('Drawing canvas')
        .evaluate((canvas: HTMLCanvasElement) => [
          ...(canvas.getContext('2d')?.getImageData(600, 450, 1, 1).data ?? []),
        ]),
    )
    .toEqual([77, 171, 247, 255]);
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

test('try the powers: big ice, fog, a sky star, a melted block and a pigeon', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/sandbox');
  await expect(page.getByText('Getting ready…')).toHaveCount(0, { timeout: 20_000 });
  await page.getByLabel('Curse').selectOption('big_ice');
  await drawRectangle(page, [0.3, 0.4, 0.7, 0.6]);
  await page.getByRole('button', { name: 'Build it' }).click();
  await expect(page.getByText('Placing')).toBeVisible();
  await page.keyboard.press('Space');
  await expect(stat(page, 'Placed')).toContainText('1', { timeout: 10_000 });
  await shot(page, '5-big-ice');
  // Fog hides the tower's top; the next piece still shows through.
  await page.getByLabel('🌫️ Fog over the tower').check();
  await drawRectangle(page, [0.3, 0.4, 0.7, 0.6]);
  await page.getByRole('button', { name: 'Build it' }).click();
  await expect(page.getByText('Placing')).toBeVisible();
  await page.waitForTimeout(500);
  await shot(page, '6-fog');
  // A sky star to catch, past the platform's edge.
  await page.getByLabel('🌫️ Fog over the tower').uncheck();
  await page.getByLabel('⭐ A sky star to catch').check();
  await expect(stat(page, 'Stars')).toContainText('0');
  await page.waitForTimeout(400);
  await shot(page, '7-star');
  // A melted block droops, doodle and all.
  await page.getByLabel('⭐ A sky star to catch').uncheck();
  await page.getByLabel('Curse').selectOption('melt');
  await drawRectangle(page, [0.3, 0.35, 0.7, 0.65]);
  await page.getByRole('button', { name: 'Fill with Blue' }).click();
  await page.getByRole('button', { name: 'Build it' }).click();
  // Drop the block still being placed, so the melted one comes next.
  await page.keyboard.press('Space');
  await expect(page.getByText('QUEUE').locator('..')).toContainText('empty', { timeout: 10_000 });
  await page.waitForTimeout(800);
  await shot(page, '8-melt');
  // A pigeon perches on the edge of the tower's top piece.
  await page.keyboard.press('Space');
  await page.waitForTimeout(2500);
  await page.getByRole('button', { name: '🐦 Land a pigeon' }).click();
  await page.waitForTimeout(800);
  await shot(page, '9-pigeon');
});

test('queue samples from the workbench and let them stack', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/sandbox');
  await expect(page.getByText('Getting ready…')).toHaveCount(0, { timeout: 20_000 });
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
