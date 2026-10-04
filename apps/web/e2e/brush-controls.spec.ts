import { expect, test } from '@playwright/test';
import { canvasHasInk, startTurn } from './support';

/**
 * The drawer adjusts size and opacity by dragging on the canvas and from the keyboard
 * (drawing-tools.md#adjusting-size-and-opacity). Runs in Chrome, Firefox and WebKit.
 */

test('drawer adjusts the brush by dragging and with the keyboard', async ({ browser }) => {
  const { host } = await startTurn(browser);
  const canvas = host.locator('canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('no canvas');
  // Whole pixels: browsers round fractional mouse positions differently.
  const cx = Math.round(box.x + box.width / 2);
  const cy = Math.round(box.y + box.height / 2);
  const size = host.getByLabel('Brush size');
  const ring = host.getByTestId('brush-cursor');
  const label = host.getByTestId('brush-cursor-label');

  // Record whether the page let the context menu through.
  await host.evaluate(() => {
    const w = window as Window & { menuShown?: boolean };
    w.menuShown = false;
    window.addEventListener('contextmenu', (e) => {
      if (!e.defaultPrevented) w.menuShown = true;
    });
  });

  await expect(size).toHaveValue('8');

  // Right-drag 50 px to the right doubles the size. The ring shows the real on-screen size.
  await host.mouse.move(cx, cy);
  await host.mouse.down({ button: 'right' });
  await host.mouse.move(cx + 50, cy + 2, { steps: 5 });
  await expect(label).toHaveText('16 px · 100%');
  await expect(ring).toBeVisible();
  const ringBox = await ring.boundingBox();
  expect(ringBox?.width).toBeCloseTo((16 * box.width) / 1200, 0);
  // Pinned where the drag began.
  expect((ringBox?.x ?? 0) + (ringBox?.width ?? 0) / 2).toBeCloseTo(cx, 0);
  await host.mouse.up({ button: 'right' });
  await expect(size).toHaveValue('16');

  // Ctrl/Cmd + drag down 80 px lowers opacity; the axis lock keeps size unchanged.
  await host.mouse.move(cx, cy);
  await host.keyboard.down('ControlOrMeta');
  await host.mouse.down();
  await host.mouse.move(cx + 4, cy + 80, { steps: 5 });
  await expect(label).toHaveText('16 px · 62%');
  await host.mouse.up();
  await host.keyboard.up('ControlOrMeta');
  await expect(host.getByRole('toolbar').getByText('62%')).toBeVisible();

  // Escape during a drag puts the settings back.
  await host.mouse.move(cx, cy);
  await host.mouse.down({ button: 'right' });
  await host.mouse.move(cx + 50, cy, { steps: 5 });
  await expect(label).toHaveText('32 px · 62%');
  await host.keyboard.press('Escape');
  await host.mouse.up({ button: 'right' });
  await expect(size).toHaveValue('16');

  // Keyboard: ] steps up, Shift+[ halves, digits set opacity. Each change shows the ring.
  await host.mouse.move(box.x + 10, box.y + 10);
  await host.keyboard.press(']');
  await expect(size).toHaveValue('19');
  await expect(label).toHaveText('19 px · 62%');
  await host.keyboard.press('Shift+BracketLeft');
  await expect(size).toHaveValue('10');
  await host.keyboard.press('4');
  await expect(label).toHaveText('10 px · 40%');

  // None of that drew anything, and the context menu never opened.
  expect(await canvasHasInk(host)).toBe(false);
  expect(await host.evaluate(() => (window as Window & { menuShown?: boolean }).menuShown)).toBe(
    false,
  );

  // A normal left drag still draws.
  await host.mouse.move(cx, cy);
  await host.mouse.down();
  await host.mouse.move(cx + 60, cy + 30, { steps: 8 });
  await host.mouse.up();
  await expect.poll(() => canvasHasInk(host)).toBe(true);
});
