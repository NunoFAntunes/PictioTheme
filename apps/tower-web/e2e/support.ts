import { expect, type Page } from '@playwright/test';

/** Names the player with the "you" sticker in the corner of the home page. */
export async function nameYourself(page: Page, name: string) {
  await page.getByRole('button', { name: /^(Name yourself|Playing as)/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Your name and drawing' });
  await dialog.getByRole('textbox', { name: 'Your name', exact: true }).fill(name);
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toBeHidden();
}
