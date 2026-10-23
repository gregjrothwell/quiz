import { test } from '@playwright/test';

import { clearEmulators } from './clearEmulator';

/**
 * Wipes the emulators before this file's own `beforeAll`.
 *
 * The spec files share one emulator and, in CI, run one after another. A later
 * file that reads season rows by name then sees rows an earlier file banked —
 * Survey Says timed out on 22 Oct waiting for three of Host, Ann and Bob and
 * finding six. Call this at the top of every spec, before any `test` or
 * `test.beforeAll`. `playwright.config.ts` uses one worker: a second would
 * wipe a file that is still playing.
 */
export function isolateFiles(): void {
  test.beforeAll(async () => {
    await clearEmulators();
  });
}
