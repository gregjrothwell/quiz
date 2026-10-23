import { expect, test } from '@playwright/test';

import { setEmulatorFlag } from './emulators';

/**
 * Fine Art has no hard questions. A Ladder of fifteen still fills from easy,
 * which is what `ladderFallbackNotices` says for that pack. The round is not
 * played out: the line is on the first question, before any reveal.
 */

test('The Ladder says when Fine Art has no hard questions', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await setEmulatorFlag(page);
  await page.goto('./');
  await page.getByPlaceholder('e.g. Greg').fill('E2E');
  await page.getByRole('button', { name: 'Start a new room' }).click();
  await expect(page.getByLabel(/Room code [A-Z0-9]{4}/)).toBeVisible();

  await page.locator('button.pack', { has: page.locator('.pack__title', { hasText: 'Fine Art' }) }).click();
  await page.getByRole('button', { name: 'Start the show' }).click();
  await page.getByRole('button', { name: 'Start the round' }).click();

  const notice = page.getByText('Out of hard questions in this pack — using easy');
  await expect(notice).toBeVisible();
  const box = await notice.boundingBox();
  expect(box).not.toBeNull();
  expect((box?.width ?? 0) > 200).toBe(true);
  expect((box?.x ?? 0) >= 0).toBe(true);
  expect((box?.x ?? 0) + (box?.width ?? 0) <= 390).toBe(true);
});
