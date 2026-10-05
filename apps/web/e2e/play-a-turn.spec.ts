import { expect, test } from '@playwright/test';
import { canvasHasInk, followInvite, hostRoom, newPlayerPage } from './support';

/** Two players in separate browser contexts play one turn through the real UI. */

test('two players create, join, draw and guess', async ({ browser }) => {
  const host = await newPlayerPage(browser);
  const guest = await newPlayerPage(browser);

  // Host: name, then one click for a private room with the default deck.
  const code = await hostRoom(host, 'Ana');

  // Guest: follows the invite link (named first on the home page).
  await followInvite(guest, code, 'Bo');
  await expect(host.getByRole('list', { name: 'Players' }).getByText('Bo')).toBeVisible();
  await expect(guest.getByText('Waiting for the host to start')).toBeVisible();
  // The room's deck, with its back cover (built-in decks show the default one).
  await expect(
    guest.getByTestId('room-deck').getByRole('img', { name: /^Cover of / }),
  ).toBeVisible();

  // Start: Ana joined first, so she draws first.
  await host.getByRole('button', { name: /start game/i }).click();
  await expect(guest.getByText(/is choosing a card/)).toBeVisible();
  await host.getByText('Choose what to draw').waitFor();
  // The drawer can rate the face-up cards without picking one; pressing again takes it back.
  const thumbsUp = host.getByRole('button', { name: /^Good card:/ }).first();
  await thumbsUp.click();
  await expect(thumbsUp).toHaveAttribute('aria-pressed', 'true');
  await host
    .getByRole('button', { name: /^Bad card:/ })
    .nth(1)
    .click();
  await expect(host.getByText('Choose what to draw')).toBeVisible(); // still choosing
  await host
    .getByRole('button', { name: /×1|silly/i })
    .first()
    .click();

  const word =
    (await host.getByTestId('current-word').textContent())?.replace('✏️', '').trim() ?? '';
  expect(word.length).toBeGreaterThan(0);
  await expect(guest.getByTestId('current-word')).toHaveCount(0); // the guesser only sees blanks

  // Draw a line; the guest's canvas receives it.
  const box = await host.locator('canvas').boundingBox();
  if (!box) throw new Error('no canvas');
  await host.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.3);
  await host.mouse.down();
  for (let i = 1; i <= 10; i++) {
    await host.mouse.move(
      box.x + box.width * (0.3 + i * 0.03),
      box.y + box.height * (0.3 + i * 0.02),
    );
  }
  await host.mouse.up();
  await expect.poll(() => canvasHasInk(guest)).toBe(true);

  // A wrong guess appears for the drawer; the right one ends the turn.
  const input = guest.getByPlaceholder('Type your guess…');
  await input.fill('definitely not it');
  await input.press('Enter');
  await expect(host.getByRole('log').getByText('definitely not it')).toBeVisible();
  await input.fill(word.toLowerCase());
  await input.press('Enter');

  await expect(guest.getByRole('log').getByText('You got it!')).toBeVisible();
  await expect(host.getByText('The word was').first()).toBeVisible();
  await expect(guest.getByText('The word was').first()).toBeVisible();
});
