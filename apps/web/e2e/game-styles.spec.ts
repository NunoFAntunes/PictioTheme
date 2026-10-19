import { expect } from '@playwright/test';
import { followInvite, hostRoom, newPlayerPage, showAllRules, test } from './support';

/**
 * The house rules' simple view (game-rules.md#game-styles): four ready-made games, the Easy game
 * by default. Picking one sets every rule; changing a rule by hand matches none of them.
 */

test('the host picks a ready-made game, and tunes it in all the rules', async ({ browser }) => {
  const host = await newPlayerPage(browser);
  const bo = await newPlayerPage(browser);
  const code = await hostRoom(host, 'Ana');
  await followInvite(bo, code, 'Bo');
  await expect(host.getByRole('list', { name: 'Players' }).getByText('Bo')).toBeVisible();

  const game = (page: typeof host, name: RegExp) =>
    page.getByRole('radiogroup', { name: 'Game' }).getByRole('radio', { name });
  await expect(game(host, /Easy game/)).toHaveAttribute('aria-checked', 'true');
  await expect(game(bo, /Easy game/)).toHaveAttribute('aria-checked', 'true');

  await game(host, /Quick and easy/).click();
  await expect(game(bo, /Quick and easy/)).toHaveAttribute('aria-checked', 'true');
  await expect(bo.getByText(/A short warm-up with easy cards/)).toBeVisible();

  // All the rules show what the game set: Quick, easy cards, no rush.
  await showAllRules(host);
  await expect(host.getByRole('radio', { name: /Quick/ })).toHaveAttribute('aria-checked', 'true');
  await expect(host.getByRole('radio', { name: 'Easy' })).toHaveAttribute('aria-checked', 'true');
  const rush = host.getByRole('switch', { name: 'Rush' });
  await expect(rush).toHaveAttribute('aria-checked', 'false');
  await rush.click();
  await expect(rush).toHaveAttribute('aria-checked', 'true');

  // Tuned by hand, it's no longer one of the games.
  await expect(bo.getByText(/The host’s own house rules/)).toBeVisible();
  await expect(game(bo, /Quick and easy/)).toHaveAttribute('aria-checked', 'false');

  // The view is each player's own, remembered in the browser.
  await host.reload();
  await expect(host.getByRole('switch', { name: 'All rules' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
});
