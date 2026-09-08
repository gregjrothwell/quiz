/**
 * Refuses a deploy that would publish a secret. Run with:
 *
 *   npm run check-bundle
 *
 * It sits between `build` and `gh-pages` in `npm run deploy`, and it exists
 * because of what happened without it.
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
 * **What it deliberately does not flag.** `VITE_FIREBASE_API_KEY`,
 * `VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_PROJECT_ID` and the reCAPTCHA site key
 * are public by design — they are in every Firebase web app that ever shipped,
 * and the rules are what protect the project. Flagging them would make this
 * noisy enough to be ignored, which is worse than not having it.
 *
 * Reads `.env.local` off disk rather than through `--env-file`, so `deploy`
 * keeps working on a machine that has no debug token set: nothing configured
 * means nothing to leak, and that is a pass rather than an error.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Secrets that must never appear in a build. The value is read from `.env.local`. */
const FORBIDDEN = ['VITE_FIREBASE_APPCHECK_DEBUG_TOKEN'] as const;

const DIST = 'dist';

/**
 * A deliberately small `.env` reader. `dotenv` is not a dependency and this
 * needs to handle exactly one shape: `KEY=value`, optionally quoted.
 */
function readEnvFile(path: string): Record<string, string> {
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
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) found.push(...filesUnder(path));
    else found.push(path);
  }
  return found;
}

function main(): void {
  const env = readEnvFile('.env.local');

  let files: string[];
  try {
    files = filesUnder(DIST);
  } catch {
    console.error(`\nNo ${DIST}/ to check. Run \`npm run build\` first.\n`);
    process.exit(1);
  }

  const configured = FORBIDDEN.filter((name) => (env[name] ?? '').length > 0);
  if (configured.length === 0) {
    console.log(`\nNothing to check: no secret from .env.local is set on this machine.\n`);
    return;
  }

  const leaks: string[] = [];
  for (const name of configured) {
    const secret = env[name];
    if (secret === undefined) continue;
    for (const file of files) {
      if (readFileSync(file).includes(secret)) leaks.push(`${name} in ${file}`);
    }
  }

  if (leaks.length > 0) {
    console.error(`\n${DIST}/ carries ${leaks.length} secret(s). This must not be deployed:\n`);
    for (const leak of leaks) console.error(`  ${leak}`);
    console.error(
      '\nGitHub Pages is world-readable, so a deploy publishes these to anybody with\n'
      + 'the URL. Check that `src/firebase.ts` still gates the debug token behind\n'
      + '`import.meta.env.DEV`, rebuild, and run this again.\n',
    );
    process.exit(1);
  }

  console.log(
    `\n${DIST}/ is clean: ${configured.length} secret(s) checked against ${files.length} file(s).\n`,
  );
}

main();
