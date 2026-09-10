import { expect, test } from '@playwright/test';

import { setEmulatorFlag } from './emulators';

test.beforeEach(async ({ page }) => {
  await setEmulatorFlag(page);
});

test('landing renders against the emulator', async ({ page }) => {
  // #given a fresh tab pointed at the production bundle
  // `./` not `/`: baseURL is `/quiz/`, and `new URL('/', base)` drops it.
  await page.goto('./');

  // #when a name is entered so the create button can enable
  await page.getByPlaceholder('e.g. Greg').fill('E2E');

  // #then the landing is up, which means anonymous auth against the emulator
  // completed — if the auth emulator is down this hangs or errors
  await expect(page.getByRole('button', { name: 'Start a new room' })).toBeEnabled();
  await expect(page.getByText('The office quiz', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Vibe Quiz' })).toBeVisible();
});

test('creating a room writes to the emulator', async ({ page }) => {
  // #given a named player on the landing screen
  await page.goto('./');
  await page.getByPlaceholder('e.g. Greg').fill('E2E');

  // #when they start a new room
  await page.getByRole('button', { name: 'Start a new room' }).click();

  // #then the lobby shows a four-character code, which only exists if Firestore
  // accepted the write. Cold emulator can take a few seconds; auto-wait, no sleep.
  await expect(page.getByLabel(/Room code [A-Z0-9]{4}/)).toBeVisible();
});
