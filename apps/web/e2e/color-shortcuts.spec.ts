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

  // Colour slots: 1–5 switch to them (black, red, blue, green, yellow to start), Shift+digit saves
  // the current colour there and the ring says so, and a right-click on a slot saves too.
  const slot = (n: number) => toolbar.getByRole('button', { name: `Colour slot ${n}` });
  await host.keyboard.press('2');
  await expect(swatch('Red')).toHaveAttribute('aria-pressed', 'true');
  await expect(slot(2)).toHaveAttribute('aria-pressed', 'true');
  await swatch('Violet').click();
  await host.keyboard.press('Shift+Digit1');
  await expect(label).toHaveText('Saved to 1');
  await host.keyboard.press('3');
  await expect(swatch('Blue')).toHaveAttribute('aria-pressed', 'true');
  await host.keyboard.press('1');
  await expect(swatch('Violet')).toHaveAttribute('aria-pressed', 'true');
  await slot(5).click({ button: 'right' });
  await expect(slot(5)).toHaveCSS('background-color', 'rgb(139, 92, 246)');
  await slot(2).click();
  await expect(swatch('Red')).toHaveAttribute('aria-pressed', 'true');
});

test('drawer picks colours on the wheel, opened with a middle-click or the toolbar', async ({
  browser,
}) => {
  const { host } = await startTurn(browser);
  const canvas = host.locator('canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('no canvas');
  const cx = Math.round(box.x + box.width / 2);
  const cy = Math.round(box.y + box.height / 2);
  const toolbar = host.getByRole('toolbar');
  const swatch = (name: string) => toolbar.getByRole('button', { name, exact: true });
  const popover = host.getByRole('dialog', { name: 'Colours' });
  const hex = popover.getByRole('textbox', { name: 'Hex colour' });

  /** Top of the hue ring (red), then drag the square to its top-right corner (full colour). */
  const dragToRed = async () => {
    const wheel = await popover.getByTestId('color-wheel').boundingBox();
    if (!wheel) throw new Error('no wheel');
    await host.mouse.click(wheel.x + wheel.width / 2, wheel.y + 6);
    await host.mouse.move(wheel.x + wheel.width / 2, wheel.y + wheel.height / 2);
    await host.mouse.down();
    await host.mouse.move(wheel.x + wheel.width + 20, wheel.y - 20, { steps: 5 });
    await host.mouse.up();
    await expect(hex).toHaveValue('#ff0000');
  };

  await swatch('Green').click();

  // A middle-click opens the colours at the pointer. The wheel previews; Esc puts it back.
  await host.mouse.move(cx, cy - 150);
  await host.mouse.down({ button: 'middle' });
  await host.mouse.up({ button: 'middle' });
  await expect(popover).toBeVisible();
  await dragToRed();
  await host.keyboard.press('Escape');
  await expect(popover).toBeHidden();
  await expect(swatch('Green')).toHaveAttribute('aria-pressed', 'true');

  // The toolbar's ink well opens it too; a hex code and Enter picks and closes.
  await toolbar.getByRole('button', { name: 'More colours' }).click();
  await expect(popover).toBeVisible();
  await hex.fill('3b82f6');
  await hex.press('Enter');
  await expect(popover).toBeHidden();
  await expect(swatch('Blue')).toHaveAttribute('aria-pressed', 'true');

  // A wheel colour is kept when the popover closes by clicking elsewhere, and joins the recent
  // colours: X swaps back to blue.
  await host.mouse.move(cx, cy - 150);
  await host.mouse.down({ button: 'middle' });
  await host.mouse.up({ button: 'middle' });
  await dragToRed();
  await host.mouse.click(box.x + 10, box.y + box.height - 10);
  await expect(popover).toBeHidden();
  await expect(swatch('Blue')).toHaveAttribute('aria-pressed', 'false');
  await host.keyboard.press('x');
  await expect(swatch('Blue')).toHaveAttribute('aria-pressed', 'true');

  // A second middle-click closes it.
  await host.mouse.down({ button: 'middle' });
  await host.mouse.up({ button: 'middle' });
  await expect(popover).toBeVisible();
  await host.mouse.down({ button: 'middle' });
  await host.mouse.up({ button: 'middle' });
  await expect(popover).toBeHidden();
});

test('drawer holds the middle button or C and lets go over a colour to pick it', async ({
  browser,
}) => {
  const { host } = await startTurn(browser);
  const canvas = host.locator('canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('no canvas');
  const cx = Math.round(box.x + box.width / 2);
  const cy = Math.round(box.y + box.height / 2);
  const toolbar = host.getByRole('toolbar');
  const swatch = (name: string) => toolbar.getByRole('button', { name, exact: true });
  const popover = host.getByRole('dialog', { name: 'Colours' });
  const centre = async (name: string | RegExp) => {
    const b = await popover.getByRole('button', { name }).first().boundingBox();
    if (!b) throw new Error(`no ${String(name)}`);
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  };

  // Some recent colours: red, then blue.
  await swatch('Red').click();
  await swatch('Blue').click();

  // Hold the middle button: the wheel opens around the pointer with the recent colours on a ring.
  // Moving onto one previews it; letting go picks it and closes.
  await host.mouse.move(cx, cy);
  await host.mouse.down({ button: 'middle' });
  await expect(popover).toBeVisible();
  if (process.env.SCREENSHOTS)
    await host.screenshot({ path: `${process.env.SCREENSHOTS}/wheel.png` });
  const red = await centre('Recent #dc2626');
  await host.mouse.move(red.x, red.y, { steps: 5 });
  await expect(popover.getByRole('textbox', { name: 'Hex colour' })).toHaveValue('#dc2626');
  await host.mouse.up({ button: 'middle' });
  await expect(popover).toBeHidden();
  await expect(swatch('Red')).toHaveAttribute('aria-pressed', 'true');

  // Letting go away from any colour closes it unchanged.
  await host.mouse.move(cx, cy);
  await host.mouse.down({ button: 'middle' });
  await expect(popover).toBeVisible();
  await host.mouse.move(box.x + 5, box.y + box.height - 5, { steps: 5 });
  await host.mouse.up({ button: 'middle' });
  await expect(popover).toBeHidden();
  await expect(swatch('Red')).toHaveAttribute('aria-pressed', 'true');

  // The same with C held, onto a palette swatch.
  await host.mouse.move(cx, cy);
  await host.keyboard.down('c');
  await expect(popover).toBeVisible();
  const lime = await centre('Lime');
  await host.mouse.move(lime.x, lime.y, { steps: 5 });
  await host.keyboard.up('c');
  await expect(popover).toBeHidden();
  await expect(swatch('Lime')).toHaveAttribute('aria-pressed', 'true');

  // Shades of the current colour: a click picks one.
  await host.keyboard.press('c');
  await expect(popover).toBeVisible();
  await popover.getByRole('button', { name: /^Lighter #/ }).click();
  await expect(popover).toBeHidden();
  await expect(swatch('Lime')).toHaveAttribute('aria-pressed', 'false');
  await host.keyboard.press('x');
  await expect(swatch('Lime')).toHaveAttribute('aria-pressed', 'true');

  // Over the wheel a hold picks the hue by direction from its centre, even across the square,
  // keeping the colour's saturation and brightness: red flicked toward green (120°) is green.
  const hex = popover.getByRole('textbox', { name: 'Hex colour' });
  const flick = async (deg: number, expected: string | RegExp) => {
    await host.mouse.move(cx, cy);
    await host.mouse.down({ button: 'middle' });
    await expect(popover).toBeVisible();
    const rad = (deg * Math.PI) / 180;
    await host.mouse.move(cx + Math.sin(rad) * 50, cy - Math.cos(rad) * 50, { steps: 5 });
    await expect(hex).toHaveValue(expected);
    await host.mouse.up({ button: 'middle' });
    await expect(popover).toBeHidden();
  };
  await swatch('Red').click();
  // Mouse positions are whole pixels, so the angle (and the red and blue) can be a hair off.
  const green = /^#2[5-8]dc2[5-8]$/;
  await flick(120, green);
  await host.keyboard.press('c');
  await expect(hex).toHaveValue(green);
  await host.keyboard.press('Escape');

  // Black has no hue to show, so a flick lifts it: toward red (0°) gives a red.
  await swatch('Black').click();
  await flick(0, /^#993[c-f]3[c-f]$/);
});
