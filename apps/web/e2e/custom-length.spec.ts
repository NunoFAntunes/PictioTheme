import { expect } from '@playwright/test';
import { followInvite, hostRoom, newPlayerPage, showAllRules, test } from './support';

/**
 * The house rules' Custom length (a ruler the host slides over the Length choices) and the room's
 * size beside public/private. The numbers reach the room only when the host presses ✓.
 */

const SHOTS = process.env.SHOTS_DIR;

test('the host sets a custom length on the ruler, and the room size', async ({ browser }) => {
  const host = await newPlayerPage(browser);
  const bo = await newPlayerPage(browser);
  const code = await hostRoom(host, 'Ana');
  await followInvite(bo, code, 'Bo');
  await expect(host.getByRole('list', { name: 'Players' }).getByText('Bo')).toBeVisible();
  if (SHOTS) await host.screenshot({ path: `${SHOTS}/1-host.png` });

  // The room size: the arrows and the keyboard, seen by the other player.
  const limit = host.getByRole('spinbutton', { name: 'Max players' });
  await expect(limit).toHaveAttribute('aria-valuenow', '10');
  await host.getByRole('button', { name: 'More players' }).click();
  await expect(limit).toHaveAttribute('aria-valuenow', '11');
  await limit.press('ArrowDown');
  await limit.press('ArrowDown');
  await expect(limit).toHaveAttribute('aria-valuenow', '9');
  await expect(bo.getByTitle('Up to 9 players')).toBeVisible();

  // Custom slides the ruler in, starting from the current length (Classic: 3 × 120s).
  await showAllRules(host);
  await showAllRules(bo);
  await host.getByRole('radio', { name: /Custom/ }).click();
  const ruler = host.getByRole('group', { name: 'Custom length' });
  const rounds = ruler.getByRole('slider', { name: 'Rounds' });
  const seconds = ruler.getByRole('slider', { name: 'Seconds to draw' });
  await expect(rounds).toBeFocused();
  await expect(rounds).toHaveAttribute('aria-valuenow', '3');
  await expect(seconds).toHaveAttribute('aria-valuenow', '120');
  // Let it finish sliding in before measuring it.
  await ruler.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
  if (SHOTS) await host.screenshot({ path: `${SHOTS}/2-ruler.png` });

  // Drag the rounds marker to the far end, and step the seconds with the keyboard.
  const box = await rounds.boundingBox();
  const track = await ruler.boundingBox();
  if (!box || !track) throw new Error('no ruler');
  await host.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await host.mouse.down();
  await host.mouse.move(track.x + track.width, box.y + box.height / 2, { steps: 8 });
  await host.mouse.up();
  await expect(rounds).toHaveAttribute('aria-valuenow', '10');
  await seconds.press('ArrowLeft');
  await seconds.press('ArrowLeft');
  await expect(seconds).toHaveAttribute('aria-valuenow', '100');
  if (SHOTS) await ruler.screenshot({ path: `${SHOTS}/3-dragged.png` });

  // Nothing has reached the room yet.
  await expect(bo.getByRole('radio', { name: /Classic/ })).toHaveAttribute('aria-checked', 'true');

  await ruler.getByRole('button', { name: /^Use / }).click();
  await expect(ruler).toHaveCount(0);
  const custom = bo.getByRole('radio', { name: /Custom/ });
  await expect(custom).toHaveAttribute('aria-checked', 'true');
  await expect(custom).toContainText('10 rounds · 100s');
  if (SHOTS) {
    await host.getByRole('radio', { name: /Custom/ }).scrollIntoViewIfNeeded();
    await host.screenshot({ path: `${SHOTS}/4-custom.png` });
  }

  // Again: Escape puts it away unchanged.
  await host.getByRole('radio', { name: /Custom/ }).click();
  await expect(rounds).toHaveAttribute('aria-valuenow', '10');
  await rounds.press('Home');
  await rounds.press('Escape');
  await expect(ruler).toHaveCount(0);
  await expect(host.getByRole('radio', { name: /Custom/ })).toContainText('10 rounds · 100s');
});
