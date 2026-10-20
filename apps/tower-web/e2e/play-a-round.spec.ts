import { expect, test, type Browser, type Page } from '@playwright/test';

/**
 * A real match against the real server (Phase 1, docs/tower/planning/roadmap.md): four players in
 * two crews; the orange drawer draws, a teammate guesses it, builds with it, and the piece is
 * placed on the orange tower. Needs the API server (TOWER_API_PORT, default 3000) and Postgres.
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

test('four players play a round: draw, guess, build, place', async ({ browser }) => {
  test.setTimeout(90_000);
  const host = await newPlayer(browser);
  await host.goto('/');
  await nameAndGo(host, 'Ana');
  await host.getByRole('button', { name: 'Create a room' }).click();
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

  // The orange drawer is the one who sees the word on their board.
  let drawer: Page | null = null;
  for (const page of players) {
    if (await page.getByLabel('Your drawing').count()) {
      const stage = page.getByTestId('stage-orange');
      if (await stage.count()) drawer = page;
    }
  }
  if (!drawer) throw new Error('no orange drawer');
  const word = (await drawer.getByTestId('word').textContent()) ?? '';
  expect(word.length).toBeGreaterThan(1);
  await drawRectangle(drawer);
  await expect(drawer.getByText(/corners? · 1 part/)).toBeVisible();
  await shot(drawer, '2-drawer');

  // An orange guesser: someone whose own stage is orange and who has the guess box.
  let guesser: Page | null = null;
  for (const page of players) {
    if (page === drawer) continue;
    const guess = page.getByLabel('Guess', { exact: true });
    if ((await guess.count()) && (await page.getByTestId('stage-orange').count())) guesser = page;
  }
  if (!guesser) throw new Error('no orange guesser');
  await shot(guesser, '3-guesser');
  await guesser.getByLabel('Guess', { exact: true }).fill(word);
  await guesser.keyboard.press('Enter');

  const decide = guesser.getByRole('dialog', { name: 'Build or send' });
  await expect(decide).toBeVisible();
  await shot(guesser, '4-decide');
  await decide.getByRole('button', { name: /Build ours/ }).click();

  // Whoever places it sees their controls; they drop it.
  let placer: Page | null = null;
  await expect
    .poll(async () => {
      for (const page of players) {
        if (await page.getByRole('button', { name: 'Drop' }).count()) {
          placer = page;
          return true;
        }
      }
      return false;
    })
    .toBe(true);
  const placing = placer as Page | null;
  if (!placing) throw new Error('no placer');
  await placing.waitForTimeout(600);
  await shot(placing, '5-placing');
  await placing.keyboard.press('Space');

  await expect(host.getByTestId('height-orange')).not.toHaveText('0.0 m', { timeout: 10_000 });
  await host.waitForTimeout(1500);
  await shot(host, '6-host');
  for (const page of players) await page.context().close();
});
