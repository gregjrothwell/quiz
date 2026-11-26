import { expect, type Page } from '@playwright/test';

/**
 * Waits until this page's lecterns can be answered. A question opens before its
 * answers land (PROJ-179), and a key pressed in between is dropped, on purpose:
 * `.podium` being on screen no longer means there is anything to press.
 */
export async function answersLanded(page: Page): Promise<void> {
  await expect(page.locator('button.tile:enabled').first()).toBeVisible();
}
