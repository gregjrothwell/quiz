import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The debug token must never reach a production build.
 *
 * `src/firebase.ts` cannot be imported here — its module body reads
 * `import.meta.env`, which Vite defines and the test environment does not — so
 * this reads it as text, exactly as the `firestore.rules` drift tests do. The
 * shape of the check is the same too: the file is the source of truth and this
 * fails loudly if somebody edits the gate away.
 *
 * **Why it exists.** Vite inlines every `VITE_`-prefixed variable into the
 * bundle at build time, and `npm run deploy` builds on the machine that holds
 * `.env.local`. Reading the token unconditionally published it to GitHub Pages
 * in all sixteen deploys from 15 August to 8 September 2026. It bypasses App
 * Check entirely, and App Check is enforced on Firestore, the RTDB and auth.
 *
 * This is the cheap half of the guard and it runs on every `npm test`.
 * `npm run check-bundle` is the other half and looks at the artefact itself,
 * because a gate can be correct and a build can still surprise you.
 */
describe('the App Check debug token is gated out of production builds', () => {
  const SOURCE = readFileSync(new URL('./firebase.ts', import.meta.url), 'utf8');

  const READ = /appCheckDebugToken[\s\S]*?;/.exec(SOURCE)?.[0];

  it('reads the token only on the DEV branch', () => {
    expect(READ).toBeDefined();
    expect(READ).toContain('import.meta.env.DEV');
  });

  it('falls back to undefined off that branch, so nothing is inlined', () => {
    // Asserted as the ternary's else branch, not merely the presence of the
    // word: the declared type is `string | undefined`, so `toContain('undefined')`
    // passes on the ungated version too. Caught by forcing this red — it is the
    // exact shape of assertion that looks like a guard and is not one.
    expect(READ).toMatch(/:\s*undefined;/);
  });

  it('never reads the variable outside the gate', () => {
    // One occurrence, and it is the one inside the ternary above. A second
    // would be a way back to shipping it that this test would otherwise miss.
    const reads = SOURCE.match(/VITE_FIREBASE_APPCHECK_DEBUG_TOKEN/g) ?? [];
    expect(reads).toHaveLength(1);
    expect(READ).toContain('VITE_FIREBASE_APPCHECK_DEBUG_TOKEN');
  });

  it('still reads the site key unconditionally, which is public and must ship', () => {
    // The counterweight: this test is about one credential, not about making
    // every VITE_ variable conditional. The site key is embedded in every page
    // that uses reCAPTCHA and the app cannot attest without it.
    const siteKey = /appCheckSiteKey[\s\S]*?;/.exec(SOURCE)?.[0];
    expect(siteKey).toBeDefined();
    expect(siteKey).not.toContain('import.meta.env.DEV');
  });
});
