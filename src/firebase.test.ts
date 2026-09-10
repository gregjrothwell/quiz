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

/**
 * The matching `{` after `header`, brace-matched. Used to pin that a call sits
 * *inside* a condition, not merely that both strings exist somewhere in the
 * file — "contains initializeAppCheck and emulatorsWanted" would pass if App
 * Check still ran on every connect and the flag was only used for
 * connectAuthEmulator.
 */
function bracedBlock(source: string, header: RegExp): string | undefined {
  const match = header.exec(source);
  if (!match) return undefined;
  const start = source.indexOf('{', match.index + match[0].length - 1);
  if (start < 0) return undefined;
  let depth = 0;
  for (let i = start; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  return undefined;
}

describe('Playwright emulator switch is a runtime flag, not a debug token', () => {
  const SOURCE = readFileSync(new URL('./firebase.ts', import.meta.url), 'utf8');
  const EMULATORS = readFileSync(new URL('./lib/emulators.ts', import.meta.url), 'utf8');

  it('still reads the debug token only once', () => {
    const reads = SOURCE.match(/VITE_FIREBASE_APPCHECK_DEBUG_TOKEN/g) ?? [];
    expect(reads).toHaveLength(1);
  });

  it('connects Auth to the emulator', () => {
    expect(SOURCE).toContain('connectAuthEmulator');
  });

  it('connects Firestore to the emulator', () => {
    expect(SOURCE).toContain('connectFirestoreEmulator');
  });

  it('connects the Realtime Database to the emulator', () => {
    expect(SOURCE).toContain('connectDatabaseEmulator');
  });

  it('points those connects at the literal 127.0.0.1, not a host from the page', () => {
    // The literal lives next to the flag, not in this file, so a second host
    // invented in firebase.ts would be a way around the hardcode. Caught by
    // forcing this red: asserting only that EMULATOR_HOST is mentioned would
    // pass if firebase.ts also read location.hostname as a fallback.
    expect(EMULATORS).toMatch(/export const EMULATOR_HOST = '127\.0\.0\.1' as const/);
    expect(SOURCE).toContain('EMULATOR_HOST');
    expect(SOURCE).not.toMatch(/location\.(hostname|host)/);
    expect(SOURCE).not.toMatch(/window\.location/);
  });

  it('skips App Check when emulators are wanted', () => {
    // The call has to sit in a block whose condition is false when
    // emulatorsWanted() is true. Presence of both names in the file is not a
    // gate.
    const inits = SOURCE.match(/initializeAppCheck\(/g) ?? [];
    expect(inits).toHaveLength(1);
    const gate = bracedBlock(SOURCE, /if\s*\(\s*!emulatorsWanted\(\)\s*&&\s*appCheckSiteKey\s*\)/);
    expect(gate).toBeDefined();
    expect(gate).toContain('initializeAppCheck');
  });

  it('only connects emulators when the flag is boolean-true', () => {
    const gate = bracedBlock(SOURCE, /if\s*\(\s*emulatorsWanted\(\)\s*\)/);
    expect(gate).toBeDefined();
    expect(gate).toContain('connectAuthEmulator');
    expect(gate).toContain('connectFirestoreEmulator');
    expect(gate).toContain('connectDatabaseEmulator');
  });
});
