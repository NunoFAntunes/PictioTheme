import { CANVAS_WIDTH } from '@pictiotheme/protocol';
import { devices, expect, type CDPSession, type Page } from '@playwright/test';
import { followInvite, hostRoom, newPlayerPage, test } from './support';

/**
 * Tablets (drawing-tools.md#touch-and-stylus, screens.md §4): the portrait layout, pen pressure,
 * palm rejection and the touch eyedropper. Chrome only: pens and touches are driven through the
 * DevTools protocol, which is how a real Apple Pencil or finger reaches the page.
 */

test.skip(({ browserName }) => browserName !== 'chromium', 'Needs the Chrome DevTools protocol');

const IPAD = devices['iPad (gen 7)']; // 810×1080 portrait, touch

type Point = { x: number; y: number };

async function pen(
  cdp: CDPSession,
  path: Point[],
  { onMid }: { onMid?: () => Promise<void> } = {},
) {
  const [first, ...rest] = path;
  if (!first) return;
  const base = { pointerType: 'pen' as const, button: 'left' as const, buttons: 1, clickCount: 1 };
  await cdp.send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    ...first,
    ...base,
    force: 0.3,
  });
  for (const [i, p] of rest.entries()) {
    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      ...p,
      ...base,
      force: 0.3 + i * 0.1,
    });
    if (i === 1) await onMid?.();
  }
  const last = rest.at(-1) ?? first;
  await cdp.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    ...last,
    ...base,
    buttons: 0,
  });
}

async function touch(
  cdp: CDPSession,
  path: Point[],
  id = 7,
  { holdMs = 0, onHeld }: { holdMs?: number; onHeld?: () => Promise<void> } = {},
) {
  const [first, ...rest] = path;
  if (!first) return;
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ ...first, id }],
  });
  if (holdMs) await new Promise((resolve) => setTimeout(resolve, holdMs));
  await onHeld?.();
  for (const p of rest) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...p, id }] });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

/** The drawing messages this page sends. */
function sentDrawOps(page: Page): { t: string; pts?: number[] }[] {
  const sent: { t: string; pts?: number[] }[] = [];
  page.on('websocket', (ws) => {
    if (!new URL(ws.url()).pathname.startsWith('/ws')) return; // not Vite's dev socket
    ws.on('framesent', (frame) => {
      if (typeof frame.payload !== 'string') return;
      const msg = JSON.parse(frame.payload) as { t?: string; pts?: number[] };
      if (msg.t?.startsWith('draw:')) sent.push({ t: msg.t, pts: msg.pts });
    });
  });
  return sent;
}

test('a tablet in portrait: tabs, pen pressure, palm rejection and the eyedropper', async ({
  browser,
}) => {
  const host = await newPlayerPage(browser, IPAD);
  const sent = sentDrawOps(host);
  const guest = await newPlayerPage(browser);

  await followInvite(guest, await hostRoom(host, 'Ana'), 'Bo');

  // Portrait: Players and Guesses are tabs under the board.
  await host.getByRole('tab', { name: /Players/ }).click();
  await expect(host.getByRole('list', { name: 'Players' }).getByText('Bo')).toBeVisible();
  await host.getByRole('tab', { name: /Guesses/ }).click();

  await host.getByRole('button', { name: /start game/i }).click();
  await host.getByRole('button', { name: /×1/ }).first().click();
  const canvas = host
    .getByRole('img', { name: /Drawing canvas/ })
    .or(host.getByLabel(/Drawing canvas/));
  // The canvas is already there under the cards: wait for the drawing tools, i.e. the pick done.
  await expect(canvas).toBeVisible();
  await expect(
    host.getByRole('button', { name: 'Pick up a colour from the drawing' }),
  ).toBeVisible();

  // Mid-match the page never scrolls, and the guess input stays on screen.
  await expect
    .poll(() => host.evaluate(() => document.documentElement.scrollHeight <= innerHeight))
    .toBe(true);
  await expect(host.getByRole('textbox').last()).toBeInViewport();

  const box = await canvas.boundingBox();
  if (!box) throw new Error('no canvas');
  const at = (fx: number, fy: number) => ({
    x: box.x + box.width * fx,
    y: box.y + box.height * fy,
  });
  const cdp = await host.context().newCDPSession(host);

  // A pen stroke, with a palm landing and lifting halfway through.
  await pen(cdp, [at(0.2, 0.2), at(0.3, 0.3), at(0.4, 0.4), at(0.5, 0.5), at(0.6, 0.5)], {
    onMid: () => touch(cdp, [at(0.8, 0.8), at(0.85, 0.85)]),
  });
  await expect.poll(() => sent.filter((m) => m.t === 'draw:end').length).toBe(1);
  const pts = sent.flatMap((m) => (m.t === 'draw:pts' ? (m.pts ?? []) : []));
  const pressures = pts.filter((_, i) => i % 3 === 2);
  expect(pressures.length).toBeGreaterThan(0);
  // The pen's real pressure, rising along the stroke (fingers and mice record a flat 0.5).
  expect(new Set(pressures).size).toBeGreaterThan(1);
  expect(Math.max(...pressures)).toBeGreaterThan(0.5);
  const xs = pts.filter((_, i) => i % 3 === 0);
  expect(Math.max(...xs)).toBeLessThan(0.7 * CANVAS_WIDTH); // nothing from the palm at 80–85%
  expect(sent.filter((m) => m.t === 'draw:begin')).toHaveLength(1);

  // A pen has been seen: touches no longer draw.
  await touch(cdp, [at(0.3, 0.7), at(0.5, 0.75), at(0.6, 0.8)]);
  await host.waitForTimeout(200);
  expect(sent.filter((m) => m.t === 'draw:begin')).toHaveLength(1);

  // 💧 picks up a colour from the drawing with the pen, then turns itself off.
  const dropper = host.getByRole('button', { name: 'Pick up a colour from the drawing' });
  await host.getByRole('button', { name: 'Red', exact: true }).click();
  await dropper.click();
  await expect(dropper).toHaveAttribute('aria-pressed', 'true');
  await pen(cdp, [at(0.4, 0.4)]);
  await expect(dropper).toHaveAttribute('aria-pressed', 'false');
  expect(sent.filter((m) => m.t === 'draw:begin')).toHaveLength(1); // picking didn't draw
});

test('without a pen, a finger draws (on the cover pad)', async ({ browser }) => {
  const page = await newPlayerPage(browser, IPAD);
  const deck = {
    id: '0190a000-0000-7000-8000-0000000000aa',
    title: 'Pirate Party',
    description: '',
    tags: ['p'],
    coverId: null,
    featured: false,
    language: 'en',
    languages: ['en'],
    counts: { easy: 2, hard: 0, chaos: 0 },
  };
  await page.route('**/api/decks/mine*', (route) => route.fulfill({ json: { decks: [deck] } }));
  await hostRoom(page, 'Ana'); // the host's deck picker, in the waiting room
  await page.getByRole('button', { name: 'Redraw the cover of Pirate Party' }).click();

  const pad = page.getByLabel('Deck cover drawing pad');
  await pad.scrollIntoViewIfNeeded();
  const box = await pad.boundingBox();
  if (!box) throw new Error('no pad');
  const at = (fx: number, fy: number) => ({
    x: box.x + box.width * fx,
    y: box.y + box.height * fy,
  });
  const cdp = await page.context().newCDPSession(page);
  const inked = () =>
    pad.evaluate((canvas: HTMLCanvasElement) => {
      const data = canvas.getContext('2d')?.getImageData(0, 0, canvas.width, canvas.height).data;
      return !!data && data.some((v, i) => i % 4 === 3 && v !== 0);
    });
  // A busy runner can take over 500ms to deliver the first move, which reads as a long-press
  // (the colours open, nothing is drawn): close them and draw again.
  await expect(async () => {
    await page.keyboard.press('Escape');
    await touch(cdp, [at(0.2, 0.2), at(0.4, 0.4), at(0.6, 0.6), at(0.8, 0.7)]);
    await expect.poll(inked, { timeout: 1000 }).toBe(true);
  }).toPass();
  // The pad is sized up for touch.
  expect(box.width).toBeGreaterThan(300);
});

test('a long-press opens the colours under the finger, and a slide picks one', async ({
  browser,
}) => {
  const page = await newPlayerPage(browser, IPAD);
  const deck = {
    id: '0190a000-0000-7000-8000-0000000000ab',
    title: 'Pirate Party',
    description: '',
    tags: ['p'],
    coverId: null,
    featured: false,
    language: 'en',
    languages: ['en'],
    counts: { easy: 2, hard: 0, chaos: 0 },
  };
  await page.route('**/api/decks/mine*', (route) => route.fulfill({ json: { decks: [deck] } }));
  await hostRoom(page, 'Ana');
  await page.getByRole('button', { name: 'Redraw the cover of Pirate Party' }).click();

  const pad = page.getByLabel('Deck cover drawing pad');
  await pad.scrollIntoViewIfNeeded();
  const box = await pad.boundingBox();
  if (!box) throw new Error('no pad');
  const at = (fx: number, fy: number) => ({
    x: box.x + box.width * fx,
    y: box.y + box.height * fy,
  });
  const inked = () =>
    pad.evaluate((canvas: HTMLCanvasElement) => {
      const data = canvas.getContext('2d')?.getImageData(0, 0, canvas.width, canvas.height).data;
      return !!data && data.some((v, i) => i % 4 === 3 && v !== 0);
    });
  const cdp = await page.context().newCDPSession(page);
  const popover = page.getByRole('dialog', { name: 'Colours' });
  const toolbar = page.getByRole('toolbar', { name: 'Deck cover tools' });

  // Holding still opens the colours and draws nothing; lifting without moving leaves them open.
  await touch(cdp, [at(0.5, 0.4)], 7, { holdMs: 800 });
  await expect(popover).toBeVisible();
  if (process.env.SCREENSHOTS)
    await page.screenshot({ path: `${process.env.SCREENSHOTS}/cover-pad.png` });
  expect(await inked()).toBe(false);
  // Where Violet is: a long-press at the same point opens it in the same place.
  const b = await popover.getByRole('button', { name: 'Violet', exact: true }).boundingBox();
  if (!b) throw new Error('no violet');
  const violet = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  await page.keyboard.press('Escape');
  await expect(popover).toBeHidden();

  // Long-press, slide onto a swatch, lift: picked.
  await touch(cdp, [at(0.5, 0.4), violet], 8, { holdMs: 800 });
  await expect(popover).toBeHidden();
  await expect(toolbar.getByRole('button', { name: 'Violet', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(await inked()).toBe(false);

  // A quick tap still draws a dot.
  await touch(cdp, [at(0.3, 0.3)], 10);
  await expect.poll(inked).toBe(true);
});
