import { expect, type Page } from '@playwright/test';
import { followInvite, hostRoom, newPlayerPage, test } from './support';

/** The feed follows the latest line, unless the reader scrolled up to read; then it offers a jump. */

async function say(page: Page, text: string) {
  const input = page.locator('#guess-input');
  await input.fill(text);
  await input.press('Enter');
}

/** Pixels between the bottom of the feed's content and the bottom of what's visible. */
function distanceFromBottom(page: Page): Promise<number> {
  return page
    .getByRole('log', { name: 'Guesses and chat' })
    .evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight);
}

test('the feed sticks to the latest message and offers a jump after scrolling up', async ({
  browser,
}) => {
  test.setTimeout(60_000);
  const host = await newPlayerPage(browser);
  const guest = await newPlayerPage(browser);
  const code = await hostRoom(host, 'Ana');
  await followInvite(guest, code, 'Bo');
  const feed = host.getByRole('log', { name: 'Guesses and chat' });
  const jump = host.getByRole('button', { name: /Jump to latest/ });

  // Enough lines to overflow the column. Chat allows ~2 messages a second.
  for (let i = 1; i <= 30; i++) {
    await say(guest, `line ${i}`);
    await expect(feed.locator('p').last()).toHaveText(`Bo: line ${i}`);
    await host.waitForTimeout(450);
  }
  expect(await feed.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
  expect(await distanceFromBottom(host)).toBeLessThan(2);
  await expect(jump).toHaveCount(0);

  // Scrolling up to read keeps the place when new lines arrive, and shows the jump button.
  await feed.hover();
  await host.mouse.wheel(0, -400);
  await expect(jump).toBeVisible();
  await say(guest, 'while you read');
  await expect(jump).toHaveAccessibleName(/new messages/);
  expect(await distanceFromBottom(host)).toBeGreaterThan(100);

  await jump.click();
  await expect(feed.getByText(/while you read/)).toBeInViewport();
  await expect(jump).toHaveCount(0);

  // Sending your own message always brings you back to the bottom.
  await host.mouse.wheel(0, -400);
  await expect(jump).toBeVisible();
  await say(host, 'my own line');
  await expect(feed.getByText(/my own line/)).toBeInViewport();
  await expect(jump).toHaveCount(0);
});
