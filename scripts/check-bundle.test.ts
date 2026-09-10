import { describe, expect, it } from 'vitest';

import { CANARY, evaluateBundle, type BundleFacts } from './check-bundle';

/**
 * The guard that stands between the App Check debug token and GitHub Pages.
 *
 * Every case here exists because the same check, in an earlier shape, either
 * could not fail or failed for the wrong reason. A deny case that passes because
 * *everything* is denied proves nothing — so each rule below is driven in both
 * directions, and the allow case is the one that says the rule landed.
 *
 * See `docs/decisions/debug-token-leak.md` and `docs/decisions/ci-deploy.md`.
 */

const TOKEN = 'VITE_FIREBASE_APPCHECK_DEBUG_TOKEN';
const API_KEY = 'AIzaSyExampleNotARealKey0000000000000000';

/** A clean laptop build: token known, canary present, nothing leaked. */
function laptop(over: Partial<BundleFacts> = {}): BundleFacts {
  return {
    ci: false,
    known: { [TOKEN]: '041D8B00-0000-0000-0000-000000000000' },
    inProcessEnv: [],
    canary: API_KEY,
    files: { 'dist/assets/index-abc.js': `const k="${API_KEY}";` },
    workflows: {},
    playwrightFiles: {},
    ...over,
  };
}

/** A clean CI build: no `.env.local`, so no token value is known at all. */
function ci(over: Partial<BundleFacts> = {}): BundleFacts {
  return {
    ci: true,
    known: { [TOKEN]: '' },
    inProcessEnv: [],
    canary: API_KEY,
    files: { 'dist/assets/index-abc.js': `const k="${API_KEY}";` },
    workflows: { '.github/workflows/ci.yml': 'name: CI\njobs:\n  verify:\n' },
    playwrightFiles: {},
    ...over,
  };
}

describe('the allow direction — a clean build is publishable', () => {
  it('passes on a laptop, having grepped the value it holds', () => {
    const verdict = evaluateBundle(laptop());
    expect(verdict.ok).toBe(true);
    if (!verdict.ok) return;
    expect(verdict.note).toContain('1 secret(s) grepped for and not found');
  });

  it('passes in CI, where the proof is the environment rather than a grep', () => {
    const verdict = evaluateBundle(ci());
    expect(verdict.ok).toBe(true);
    if (!verdict.ok) return;
    expect(verdict.note).toContain('No forbidden variable is present');
  });

  it('says what it did not cover, rather than reporting a clean bill', () => {
    // The half that stops the next person assuming more was proved than was.
    // In CI nothing is grepped for, and the pass must admit that in words.
    const verdict = evaluateBundle(ci());
    expect(verdict.ok).toBe(true);
    if (!verdict.ok) return;
    expect(verdict.notCovered.join(' ')).toContain('were not grepped for');
    expect(verdict.notCovered.join(' ')).toContain('reCAPTCHA allowlist');
  });

  it('passes when e2e files exist but do not name the variable', () => {
    const verdict = evaluateBundle(ci({
      playwrightFiles: {
        'playwright.config.ts': "export default { testDir: 'e2e' };\n",
        'e2e/smoke.spec.ts': "test('landing', async ({ page }) => { await page.goto('./'); });\n",
      },
    }));
    expect(verdict.ok).toBe(true);
  });
});

describe('the deny direction — each rule refuses, and for its own reason', () => {
  it('refuses when the token is in the CI environment at all', () => {
    const verdict = evaluateBundle(ci({ inProcessEnv: [TOKEN] }));
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.reason).toContain('set in this CI environment');
    // The remedy matters as much as the refusal: an E2E runner is the obvious
    // reason somebody adds this, and the emulator is the answer.
    expect(verdict.reason).toContain('emulator');
  });

  it('does not refuse a laptop for holding the token — that is where it lives', () => {
    // The counterweight. `.env.local` holding the token is normal and required
    // for `npm run dev`; only CI treats its presence as the failure.
    const verdict = evaluateBundle(laptop({ inProcessEnv: [TOKEN] }));
    expect(verdict.ok).toBe(true);
  });

  it('refuses when a workflow names the variable, even unset', () => {
    const verdict = evaluateBundle(ci({
      workflows: { '.github/workflows/ci.yml': `env:\n  ${TOKEN}: \${{ secrets.T }}\n` },
    }));
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.reason).toContain('.github/workflows/ci.yml');
  });

  it('refuses when a playwright config names the variable, even unset', () => {
    const verdict = evaluateBundle(ci({
      playwrightFiles: { 'playwright.config.ts': `use: { /* ${TOKEN} */ }\n` },
    }));
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.reason).toContain('playwright.config.ts');
  });

  it('refuses when an e2e spec names the variable, even unset', () => {
    const verdict = evaluateBundle(ci({
      playwrightFiles: { 'e2e/helpers.ts': `const leaked = process.env.${TOKEN};\n` },
    }));
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.reason).toContain('e2e/helpers.ts');
  });

  it('refuses when the secret is actually in a built file', () => {
    const secret = laptop().known[TOKEN] as string;
    const verdict = evaluateBundle(laptop({
      files: { 'dist/assets/index-abc.js': `const k="${API_KEY}";const d="${secret}";` },
    }));
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.reason).toContain('dist/assets/index-abc.js');
  });

  it('refuses when dist/ is empty rather than reporting nothing found', () => {
    const verdict = evaluateBundle(laptop({ files: {} }));
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.reason).toContain('npm run build');
  });
});

describe('the instrument is checked before its silence is believed', () => {
  it('refuses when the canary is missing, because then the search proves nothing', () => {
    // The exact failure this guards: a grep that finds nothing because it is
    // broken reads identically to a grep that finds nothing because the bundle
    // is clean. 8 September: this grep's silence was only trusted after the
    // same grep was run for a value known to be present.
    const verdict = evaluateBundle(ci({
      files: { 'dist/assets/index-abc.js': 'const k="nothing-inlined";' },
    }));
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.reason).toContain('canary');
    expect(verdict.reason).toContain('proves nothing');
  });

  it('refuses when the canary value is unknown, rather than skipping the check', () => {
    const verdict = evaluateBundle(ci({ canary: '' }));
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.reason).toContain(CANARY);
    expect(verdict.reason).toContain('variable');
  });

  it('reports where the canary was found, so a pass carries its own evidence', () => {
    const verdict = evaluateBundle(ci({
      files: {
        'dist/assets/index-abc.js': `const k="${API_KEY}";`,
        'dist/assets/firebase-xyz.js': `const k="${API_KEY}";`,
        'dist/index.html': '<!doctype html>',
      },
    }));
    expect(verdict.ok).toBe(true);
    if (!verdict.ok) return;
    expect(verdict.note).toContain('found in 2');
  });
});

describe('the order of the rules is itself load-bearing', () => {
  it('reports the environment before the file, because it explains the file', () => {
    // Both wrong at once. The token being on the build machine is the finding;
    // the token being in one chunk is its symptom, and naming the symptom first
    // sends the next person to rebuild rather than to the workflow.
    const secret = 'a-real-looking-token';
    const verdict = evaluateBundle(ci({
      known: { [TOKEN]: secret },
      inProcessEnv: [TOKEN],
      files: { 'dist/assets/index-abc.js': `const k="${API_KEY}";const d="${secret}";` },
    }));
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.reason).toContain('set in this CI environment');
    expect(verdict.reason).not.toContain('index-abc.js');
  });
});
