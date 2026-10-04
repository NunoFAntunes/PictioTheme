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

export async function pickIdentity(page: Page, name: string, submit: RegExp) {
  await page.getByLabel('Your name').fill(name);
  await page.getByRole('button', { name: submit }).click();
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

  await host.goto('/play');
  await pickIdentity(host, 'Ana', /play/i);
  await host.getByRole('button', { name: /create room/i }).click();
  const codeButton = host.getByTestId('room-code');
  await expect(codeButton).toHaveText(/^[A-Z]{3}-[A-Z]{3}$/);
  const code = (await codeButton.textContent()) ?? '';

  await guest.goto(`/r/${code}`);
  await pickIdentity(guest, 'Bo', /join room/i);
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
