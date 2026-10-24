import { defineConfig } from '@playwright/test';

/**
 * Emulators are started *outside* Playwright, by `firebase emulators:exec`
 * (`npm run e2e`). This config only serves the production `dist/` — it does
 * not rebuild, and it does not pass a host or ports into the page. The app
 * reads `window.__QUIZ_EMULATORS__` (set by the e2e init script) and points
 * itself at 127.0.0.1:9099 / 8080 / 9000.
 */
export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  expect: { timeout: 20_000 },
  // One worker. Each spec wipes the emulators before it starts (`e2e/isolate.ts`).
  // A second worker would wipe a file that is still playing. The default is
  // half the cores, which ran files in parallel locally and hid the shared
  // season rows that CI, one file after another, then tripped over.
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173/quiz/',
  },
  webServer: {
    command: 'npx vite preview --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173/quiz/',
    reuseExistingServer: !process.env.CI,
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
