/**
 * Refuses a deploy that would publish a secret. Run with:
 *
 *   npm run check-bundle
 *
 * It sits between `build` and the `gh-pages` push — locally in `npm run deploy`,
 * and in CI as its own step — and it exists because of what happened without it.
 *
 * **The leak this was written for.** `VITE_FIREBASE_APPCHECK_DEBUG_TOKEN` was
 * read unconditionally in `src/firebase.ts`. Vite inlines every `VITE_`-prefixed
 * variable into the bundle at build time, and `npm run deploy` builds on the
 * machine that holds `.env.local` — so the token shipped to GitHub Pages, where
 * anybody could `curl` it. It was live in all sixteen deploys from 15 August to
 * 8 September 2026. The token bypasses App Check entirely, and the two other
 * inputs to `exchangeDebugToken` (the API key and the app id) are *supposed* to
 * be public and were sitting right beside it.
 *
 * **`.gitignore` was never the problem.** The repo was clean the whole time —
 * every audit checked `master` and passed. The leak channel was the build
 * artefact, which nothing looked at. That is the gap this closes.
 *
 * `src/firebase.ts` now gates the read behind `import.meta.env.DEV`, which is a
 * compile-time constant, so the literal should never reach the output. This
 * checks rather than trusts: a gate nobody verifies is how the first one lasted
 * twenty-four days.
 *
 * ## Two machines, two different proofs
 *
 * **On a laptop** the token is in `.env.local`, so the check is a grep: find the
 * literal in `dist/` and refuse.
 *
 * **In CI there is no `.env.local`**, so there is no literal to grep for — and a
 * check that cannot see a leak must not report a pass. It proves a different and
 * stronger thing instead: that the token is **not on the build machine at all**.
 * A CI runner can only inline what it was given, so a build environment with no
 * debug token in it cannot produce a bundle with one. That removes the channel
 * rather than inspecting the output afterwards.
 *
 * **An E2E runner is the obvious way this recurs.** Playwright or anything else
 * that needs to attest would want a debug token in the environment, and that is
 * the same mistake with a different filename. Give it the Firebase emulator
 * instead — `docs/decisions/audit-backlog.md`, `docs/decisions/ci-deploy.md`.
 *
 * ## The instrument is checked before its silence is believed
 *
 * "The token is absent from `dist/`" means nothing if the search is broken. So
 * every run also looks for `VITE_FIREBASE_API_KEY`, which is public, is inlined
 * by the same mechanism, and **must be found**. If the canary is missing, the
 * search is not working — or the build never got its environment — and the
 * silence about the token is worthless. That is a failure, not a pass.
 *
 * The habit comes from 8 September, when this grep's silence was only trusted
 * after the same grep was run for a value known to be present. Two instruments
 * lied that day; see `docs/decisions/debug-token-leak.md`.
 *
 * **What it deliberately does not flag.** `VITE_FIREBASE_API_KEY`,
 * `VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_PROJECT_ID` and the reCAPTCHA site key
 * are public by design — they are in every Firebase web app that ever shipped,
 * and the rules are what protect the project. Flagging them would make this
 * noisy enough to be ignored, which is worse than not having it.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Secrets that must never appear in a build, nor in a workflow's environment. */
export const FORBIDDEN = ['VITE_FIREBASE_APPCHECK_DEBUG_TOKEN'] as const;

/**
 * Public, inlined by the same mechanism as the secret, and therefore the thing
 * that proves the search works. Not a secret and never reported as one.
 */
export const CANARY = 'VITE_FIREBASE_API_KEY';

const DIST = 'dist';
const WORKFLOWS = '.github/workflows';

/**
 * The facts the verdict depends on, so the verdict is testable without a disk.
 * `main()` gathers these; the tests drive `evaluateBundle` directly.
 */
export interface BundleFacts {
  /** True on a CI runner, where `.env.local` is absent by design. */
  ci: boolean;
  /** Forbidden name → the value this machine knows for it. Empty means unknown. */
  known: Record<string, string>;
  /** Forbidden names found in the *process* environment, which is the CI failure. */
  inProcessEnv: readonly string[];
  /** The canary's value, or empty if this machine does not know it either. */
  canary: string;
  /** Every file under `dist/`, path → contents. */
  files: Record<string, string>;
  /** Every file under `.github/workflows/`, path → contents. */
  workflows: Record<string, string>;
}

export type Verdict =
  | { ok: true; note: string; notCovered: readonly string[] }
  | { ok: false; reason: string };

/**
 * Pure: given what is on the machine and in the artefact, decide whether this
 * build may be published. Ordered so the most structural failure reports first —
 * a token on the build machine is a worse finding than a token in one file,
 * because it explains every file.
 */
export function evaluateBundle(facts: BundleFacts): Verdict {
  // 1. The channel itself. Under CI the token has no legitimate reason to exist
  //    in the environment, and if it does the bundle is only clean by luck.
  if (facts.ci && facts.inProcessEnv.length > 0) {
    return {
      ok: false,
      reason:
        `${facts.inProcessEnv.join(', ')} is set in this CI environment.\n`
        + '  A runner can only inline what it was given, and that absence is the\n'
        + '  whole mechanism keeping the token out of the bundle. Remove it from\n'
        + '  the workflow env, the repository secrets and the variables.\n\n'
        + '  If this was added for an E2E runner: give it the Firebase emulator\n'
        + '  instead. See docs/decisions/ci-deploy.md.',
    };
  }

  // 2. A workflow that names it is the same failure one commit earlier.
  const naming = Object.entries(facts.workflows)
    .filter(([, text]) => FORBIDDEN.some((name) => text.includes(name)))
    .map(([path]) => path);
  if (naming.length > 0) {
    return {
      ok: false,
      reason:
        `a workflow names a forbidden variable: ${naming.join(', ')}.\n`
        + '  Even unset, wiring the name into a build step is how it gets a value\n'
        + '  later. The deploy job must not know this variable exists.',
    };
  }

  const fileCount = Object.keys(facts.files).length;
  if (fileCount === 0) {
    return { ok: false, reason: `no ${DIST}/ to check. Run \`npm run build\` first.` };
  }

  // 3. Prove the search works before trusting anything it fails to find.
  if (facts.canary === '') {
    return {
      ok: false,
      reason:
        `${CANARY} is unknown on this machine, so the search cannot be checked.\n`
        + '  Without a value known to be in the bundle there is no way to tell a\n'
        + '  clean artefact from a broken grep, and this must not pass blind.\n'
        + `  In CI, set ${CANARY} as a repository *variable* — it is public.`,
    };
  }
  const canaryHits = Object.keys(facts.files).filter((path) => facts.files[path]?.includes(facts.canary));
  if (canaryHits.length === 0) {
    return {
      ok: false,
      reason:
        `the canary ${CANARY} was not found anywhere in ${DIST}/.\n`
        + '  It is public, it is inlined by the same mechanism as the secret, and\n'
        + '  it must be there. Either this search is broken or the build never got\n'
        + '  its environment — and until that is resolved, finding no debug token\n'
        + '  proves nothing at all.',
    };
  }

  // 4. Only now is the absence of the real secret worth reading.
  const leaks: string[] = [];
  for (const name of FORBIDDEN) {
    const secret = facts.known[name];
    if (secret === undefined || secret === '') continue;
    for (const [path, text] of Object.entries(facts.files)) {
      if (text.includes(secret)) leaks.push(`${name} in ${path}`);
    }
  }
  if (leaks.length > 0) {
    return {
      ok: false,
      reason:
        `${DIST}/ carries ${leaks.length} secret(s). This must not be deployed:\n`
        + leaks.map((leak) => `    ${leak}`).join('\n')
        + '\n\n  GitHub Pages is world-readable, so a deploy publishes these to anybody\n'
        + '  with the URL. Check that `src/firebase.ts` still gates the debug token\n'
        + '  behind `import.meta.env.DEV`, rebuild, and run this again.',
    };
  }

  // What was actually proved, and — per docs/EVIDENCE — what was not.
  const grepped = FORBIDDEN.filter((name) => (facts.known[name] ?? '') !== '');
  const notCovered: string[] = [];
  if (grepped.length < FORBIDDEN.length) {
    notCovered.push(
      `${FORBIDDEN.length - grepped.length} forbidden value(s) were not grepped for, `
      + 'because this machine does not hold them. Their absence rests on the '
      + 'environment check above, not on a search.',
    );
  }
  notCovered.push('secrets introduced by any route other than `.env.local` or the environment are invisible here.');
  notCovered.push('the reCAPTCHA allowlist is console state and cannot be read from the repo.');

  return {
    ok: true,
    note:
      `${fileCount} file(s) checked. Canary ${CANARY} found in ${canaryHits.length}, so the search works. `
      + (facts.ci
        ? `No forbidden variable is present in this CI environment, and no workflow names one.`
        : `${grepped.length} secret(s) grepped for and not found.`),
    notCovered,
  };
}

/**
 * A deliberately small `.env` reader. `dotenv` is not a dependency and this
 * needs to handle exactly one shape: `KEY=value`, optionally quoted.
 */
export function readEnvFile(path: string): Record<string, string> {
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    return {};
  }

  const env: Record<string, string> = {};
  for (const line of raw.split('\n')) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    const [, key, value] = match;
    if (key === undefined || value === undefined) continue;
    env[key] = value.trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

function filesUnder(dir: string): string[] {
  const found: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  for (const entry of entries) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) found.push(...filesUnder(path));
    else found.push(path);
  }
  return found;
}

function readAll(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const path of filesUnder(dir)) out[path] = readFileSync(path, 'latin1');
  return out;
}

function gatherFacts(): BundleFacts {
  // `.env.local` first, then the process environment. On a laptop the file is
  // the source; in CI the file is absent and the variables are the source.
  const fromFile = readEnvFile('.env.local');
  const valueOf = (name: string): string => fromFile[name] ?? process.env[name] ?? '';

  const known: Record<string, string> = {};
  for (const name of FORBIDDEN) known[name] = valueOf(name);

  return {
    ci: (process.env.CI ?? '') !== '',
    known,
    inProcessEnv: FORBIDDEN.filter((name) => (process.env[name] ?? '') !== ''),
    canary: valueOf(CANARY),
    files: readAll(DIST),
    workflows: readAll(WORKFLOWS),
  };
}

function main(): void {
  const verdict = evaluateBundle(gatherFacts());

  if (!verdict.ok) {
    console.error(`\ncheck-bundle: refusing — ${verdict.reason}\n`);
    process.exit(1);
  }

  console.log(`\ncheck-bundle: ${verdict.note}`);
  console.log('\n  Not covered by this check:');
  for (const gap of verdict.notCovered) console.log(`    - ${gap}`);
  console.log('');
}

// Pure exports above are imported by the test; the IO only runs as a script.
if (process.argv[1] === fileURLToPath(import.meta.url)) main();
