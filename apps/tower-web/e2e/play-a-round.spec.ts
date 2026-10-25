import { expect, test, type Browser, type Page } from '@playwright/test';
import { nameYourself } from './support';

/**
 * A real match against the real server (Phase 1, docs/tower/planning/roadmap.md): four players in
 * two crews; the orange drawer draws and colours it in, a teal player steals it from their own
 * guess line, builds with it, and the piece is placed on the teal tower. Needs the API server (TOWER_API_PORT, default 3000) and Postgres.
 * `SCREENSHOTS=<dir>` saves pictures of each stage.
 */

const shot = async (page: Page, name: string) => {
  const dir = process.env.SCREENSHOTS;
  if (dir) await page.screenshot({ path: `${dir}/${name}.png` });
};

async function newPlayer(browser: Browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  return context.newPage();
}

async function nameAndGo(page: Page, name: string) {
  await page.getByLabel('Your name').fill(name);
}

/** Draws a closed rectangle on the drawer's board, in fractions of the board. */
async function drawRectangle(page: Page) {
  const board = page.getByLabel('Your drawing');
  const box = await board.boundingBox();
  if (!box) throw new Error('no board');
  const at = (fx: number, fy: number) => [box.x + box.width * fx, box.y + box.height * fy] as const;
  await page.mouse.move(...at(0.25, 0.35));
  await page.mouse.down();
  for (const [fx, fy] of [
    [0.75, 0.35],
    [0.75, 0.65],
    [0.25, 0.65],
    [0.25, 0.36],
  ] as const) {
    await page.mouse.move(...at(fx, fy), { steps: 12 });
  }
  await page.mouse.up();
}

test('four players play a round: draw, guess, steal, fumble, cast a spell', async ({ browser }) => {
  test.setTimeout(90_000);
  const host = await newPlayer(browser);
  await host.goto('/');
  await nameYourself(host, 'Ana');
  await host.getByRole('button', { name: 'Create a lobby' }).click();
  await expect(host).toHaveURL(/\/r\/[A-Z]{3}-[A-Z]{3}$/);
  const code = (await host.getByTestId('room-code').textContent()) ?? '';

  const players = [host];
  for (const name of ['Bo', 'Cy', 'Di']) {
    const page = await newPlayer(browser);
    await page.goto(`/r/${code}`);
    await nameAndGo(page, name);
    await page.getByRole('button', { name: 'Join the crews' }).click();
    await expect(page.getByTestId('room-code')).toHaveText(code);
    players.push(page);
  }
  await expect(host.getByRole('listitem').filter({ hasText: 'Di' })).toBeVisible();
  await shot(host, '1-waiting');

  await host.getByRole('button', { name: 'Start building' }).click();
  for (const page of players) {
    await expect(page.getByRole('region', { name: 'Orange tower' })).toBeVisible();
  }

  // The orange drawer is the one whose orange board is theirs to draw on.
  let drawer: Page | null = null;
  for (const page of players) {
    if (await page.getByTestId('stage-orange').getByLabel('Your drawing').count()) drawer = page;
  }
  if (!drawer) throw new Error('no orange drawer');
  const word = (await drawer.getByTestId('word').textContent()) ?? '';
  expect(word.length).toBeGreaterThan(1);
  await drawRectangle(drawer);
  await expect(drawer.getByText(/corners? · 1 part/)).toBeVisible();
  const board = drawer.getByLabel('Your drawing');
  const centrePixel = () =>
    board.evaluate((canvas: HTMLCanvasElement) => [
      ...(canvas.getContext('2d')?.getImageData(600, 450, 1, 1).data ?? []),
    ]);

  // Closing the rectangle offers colours for it: one tap colours it in.
  await drawer.getByRole('button', { name: 'Fill with Yellow' }).click();
  await expect(drawer.getByRole('group', { name: 'Colour in this shape' })).toHaveCount(0);
  await expect.poll(centrePixel).toEqual([255, 212, 59, 255]);

  // The bucket colours the inside of the rectangle, but not the background.
  await drawer.getByRole('button', { name: 'Paint bucket' }).click();
  await board.click({ position: { x: 8, y: 8 } });
  await expect(drawer.getByText('The bucket only fills closed shapes')).toBeVisible();
  const box = await board.boundingBox();
  if (!box) throw new Error('no board');
  await board.click({ position: { x: box.width / 2, y: box.height / 2 } });
  await expect.poll(centrePixel).toEqual([27, 36, 51, 255]);
  await shot(drawer, '2-drawer');

  // A teal guesser (not drawing): they steal it, typing in their usual guess line.
  let guesser: Page | null = null;
  for (const page of players) {
    const teal = page.getByTestId('stage-teal');
    if (
      (await teal.getByText('YOUR CREW').count()) &&
      !(await teal.getByLabel('Your drawing').count())
    )
      guesser = page;
  }
  if (!guesser) throw new Error('no teal guesser');
  await shot(guesser, '3-guesser');
  await guesser.getByLabel('Guess', { exact: true }).fill(word);
  await guesser.keyboard.press('Enter');

  const decide = guesser.getByRole('dialog', { name: 'Keep or curse' });
  await expect(decide).toBeVisible();
  await expect(decide).toContainText('Stolen!');
  await expect(decide.getByRole('button', { name: /Curse/ })).toBeVisible();
  await shot(guesser, '4-decide');
  await decide.getByRole('button', { name: /Keep/ }).click();

  // The thief keeps it, so they place it: their controls light up, and they drop it.
  let placer: Page | null = null;
  await expect
    .poll(async () => {
      for (const page of players) {
        // Everyone has the controls on their play card; only the placer's are live.
        if (await page.getByRole('button', { name: 'Drop', disabled: false }).count()) {
          placer = page;
          return true;
        }
      }
      return false;
    })
    .toBe(true);
  const placing = placer as Page | null;
  if (!placing) throw new Error('no placer');
  expect(placing).toBe(guesser);
  await placing.waitForTimeout(600);
  await shot(placing, '5-placing');
  // Steer it out past the platform's edge and drop it: it falls off.
  await placing.keyboard.down('ArrowLeft');
  await placing.waitForTimeout(2000);
  await placing.keyboard.up('ArrowLeft');
  await placing.keyboard.press('Space');

  // The fumble gives Teal a comeback spell, which the thief casts at Orange's tower.
  const cast = placing.getByRole('button', { name: /^Cast .+ at Orange/ });
  await expect(cast).toBeEnabled({ timeout: 10_000 });
  await expect(host.getByLabel('Teal spells').getByLabel(/Fog|Magpie|Shaky hand/)).toBeVisible();
  await cast.click();
  await expect(
    host.getByRole('status').filter({ hasText: /is casting (Fog|Magpie|Shaky hand)/ }),
  ).toBeVisible();
  await expect(placing.getByLabel('Teal spells').getByRole('button')).toHaveCount(0);
  await shot(host, '6-host');
  for (const page of players) await page.context().close();
});
