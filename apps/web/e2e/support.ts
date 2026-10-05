import { expect, type Browser, type BrowserContextOptions, type Page } from '@playwright/test';

/** Shared steps for the e2e specs. */

/**
 * A player in their own browser context. Hides the Astro dev toolbar, which sits over the bottom
 * centre of the page in dev and otherwise intercepts clicks there (e.g. "Start game").
 */
export async function newPlayerPage(
  browser: Browser,
  options: BrowserContextOptions = {},
): Promise<Page> {
  const context = await browser.newContext(options);
  await context.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style');
      style.textContent = 'astro-dev-toolbar { display: none !important; }';
      document.head.append(style);
    });
  });
  return context.newPage();
}

/**
 * Opens the home page and names the player with the "Playing as" chip (nobody has to: first-time
 * players get a silly name). `draw` can draw on the avatar pad before saving.
 */
export async function nameOnHome(page: Page, name: string, draw?: (page: Page) => Promise<void>) {
  await page.goto('/');
  await page.getByRole('button', { name: /^Playing as/ }).click();
  await page.getByRole('textbox', { name: 'Your name', exact: true }).fill(name);
  await draw?.(page);
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('button', { name: new RegExp(`^Playing as ${name}`) })).toBeVisible();
}

/** Names the player, then one click on "New private room". Resolves to the room code. */
export async function hostRoom(page: Page, name: string): Promise<string> {
  await nameOnHome(page, name);
  await page.getByRole('button', { name: /new private room/i }).click();
  const codeButton = page.getByTestId('room-code');
  // The room is a client-only island: on a busy CI runner (WebKit especially) loading its dev
  // modules and joining can take longer than the default 5s.
  await expect(codeButton).toHaveText(/^[A-Z]{3}-[A-Z]{3}$/, { timeout: 15_000 });
  return (await codeButton.textContent()) ?? '';
}

/** Follows an invite link as `name` (invite links skip the name form). */
export async function followInvite(page: Page, code: string, name: string) {
  await nameOnHome(page, name);
  await page.goto(`/r/${code}`);
}

/** True when the canvas has any non-transparent pixel. */
export function canvasHasInk(page: Page): Promise<boolean> {
  return page.locator('canvas').evaluate((canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 3; i < data.length; i += 4) if (data[i] !== 0) return true;
    return false;
  });
}

/** Host creates a room, a guest joins by invite link, the host starts and picks a card. */
export async function startTurn(browser: Browser): Promise<{ host: Page; guest: Page }> {
  const host = await newPlayerPage(browser);
  const guest = await newPlayerPage(browser);

  const code = await hostRoom(host, 'Ana');

  await followInvite(guest, code, 'Bo');
  await expect(host.getByRole('list', { name: 'Players' }).getByText('Bo')).toBeVisible();

  // Ana joined first, so she draws first.
  await host.getByRole('button', { name: /start game/i }).click();
  await host.getByText('Choose what to draw').waitFor();
  await host
    .getByRole('button', { name: /×1|silly/i })
    .first()
    .click();
  await expect(host.getByTestId('current-word')).toBeVisible();
  return { host, guest };
}
