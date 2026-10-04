import { expect, test } from '@playwright/test';
import { startTurn } from './support';

/**
 * The drawer samples colours from the canvas and switches colours from the keyboard
 * (drawing-tools.md#picking-and-sampling-colours). Runs in Chrome, Firefox and WebKit.
 */

test('drawer samples, swaps and picks colours with shortcuts', async ({ browser }) => {
  const { host } = await startTurn(browser);
  const canvas = host.locator('canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('no canvas');
  const cx = Math.round(box.x + box.width / 2);
  const cy = Math.round(box.y + box.height / 2);
  const toolbar = host.getByRole('toolbar');
  const swatch = (name: string) => toolbar.getByRole('button', { name, exact: true });
  const label = host.getByTestId('brush-cursor-label');

  // A thick red line through the centre, then switch to blue.
  await swatch('Red').click();
  await toolbar.getByRole('button', { name: /XL/ }).click();
  await host.mouse.move(cx - 80, cy);
  await host.mouse.down();
  await host.mouse.move(cx + 80, cy, { steps: 10 });
  await host.mouse.up();
  await swatch('Blue').click();
  await expect(swatch('Blue')).toHaveAttribute('aria-pressed', 'true');

  // Holding Alt previews the colour under the pointer; Alt+click picks it up.
  await host.mouse.move(cx, cy);
  await host.keyboard.down('Alt');
  await host.mouse.move(cx + 1, cy);
  await expect(label).toHaveText('#dc2626');
  await host.mouse.down();
  await host.mouse.up();
  await host.keyboard.up('Alt');
  await expect(swatch('Red')).toHaveAttribute('aria-pressed', 'true');

  // X swaps back to the previous colour, and again to red.
  await host.keyboard.press('x');
  await expect(swatch('Blue')).toHaveAttribute('aria-pressed', 'true');
  await host.keyboard.press('x');
  await expect(swatch('Red')).toHaveAttribute('aria-pressed', 'true');

  // A quick right-click (no drag) on blank canvas samples the white background.
  await host.mouse.move(box.x + 20, box.y + 20);
  await host.mouse.down({ button: 'right' });
  await host.mouse.up({ button: 'right' });
  await expect(swatch('White')).toHaveAttribute('aria-pressed', 'true');

  // C opens the colours at the pointer; picking one closes it. Recent colours are listed.
  await host.mouse.move(cx, cy + 100);
  await host.keyboard.press('c');
  const popover = host.getByRole('dialog', { name: 'Colours' });
  await expect(popover).toBeVisible();
  await expect(popover.getByRole('button', { name: 'Recent #dc2626' })).toBeVisible();
  await popover.getByRole('button', { name: 'Green', exact: true }).click();
  await expect(popover).toBeHidden();
  await expect(swatch('Green')).toHaveAttribute('aria-pressed', 'true');

  // Esc and a click outside close it without changing the colour or drawing.
  await host.keyboard.press('c');
  await expect(popover).toBeVisible();
  await host.keyboard.press('Escape');
  await expect(popover).toBeHidden();
  await host.keyboard.press('c');
  await host.mouse.click(box.x + 20, box.y + box.height - 20);
  await expect(popover).toBeHidden();
  await expect(swatch('Green')).toHaveAttribute('aria-pressed', 'true');
});
