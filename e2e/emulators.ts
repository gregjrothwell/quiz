import type { Page } from '@playwright/test';

import { EMULATOR_FLAG } from '../src/lib/emulators';

/**
 * Point the app at the local Firebase emulators. Must run before the page
 * loads — `addInitScript` injects before any document scripts. Boolean `true`
 * only; the host is hardcoded in the app, not passed from here.
 */
export async function setEmulatorFlag(page: Page): Promise<void> {
  await page.addInitScript((flag: string) => {
    Object.assign(window, { [flag]: true });
  }, EMULATOR_FLAG);
}
