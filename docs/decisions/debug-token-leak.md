# The App Check debug token in the bundle

> **Owner: Greg Rothwell. Last updated: 10 September 2026. Budget: 250 lines.**

`VITE_FIREBASE_APPCHECK_DEBUG_TOKEN` shipped to GitHub Pages, twice. This is what
it is, why the build was the leak channel and not the repo, and what now stands
between it and a third time.

## What the token is

A registered App Check debug token (App Check → Manage debug tokens). It bypasses
reCAPTCHA attestation entirely — a client that presents it is trusted by
Firestore, the RTDB and auth without proving it is a real browser. It exists so
`npm run dev` on localhost, which reCAPTCHA will not vouch for, can still talk to
the live project. It lives in `.env.local`, which is gitignored.

The other two inputs to `exchangeDebugToken` — the API key and the app id — are
public by design and sit in the same bundle. The token is the one value there
that is a real credential.

## The leak channel was the build, not the repo

Vite inlines every `VITE_`-prefixed variable into the output at build time.
`npm run deploy` runs `gh-pages -d dist` from whichever machine ran the build —
the one holding `.env.local`. So an unconditional
`import.meta.env.VITE_FIREBASE_APPCHECK_DEBUG_TOKEN` in `src/firebase.ts` put the
literal into `dist/assets/index-*.js` and published it world-readable.

**The repo was clean the whole time.** Every audit checked `master` and passed.
`.gitignore` was never the problem. Nothing looked at the artefact, and the
artefact was the leak.

## It shipped twice

- **15 August – 8 September 2026**, sixteen deploys. Fixed 8 September on
  `seal-the-debug-token` (`49c8b3e`): the read moved behind `import.meta.env.DEV`,
  a text test in `src/firebase.test.ts`, and `scripts/check-bundle.ts` to grep
  the built artefact. That branch was pushed (PR #35) and **never merged**.
- **10 September 2026**, one deploy. `npm run deploy` was run from `master` for
  the volume/tunes release. Master still read the token unconditionally — the
  8 September fix was on an unmerged branch — so the deploy put it straight back.
  Caught the same afternoon by grepping the served bundle: one hit in
  `index-C3jZR3XU.js`.

Both times the cause was identical: **the gate existed only on a branch, and the
deploy came off `master`.**

## What stands between it and a third time

Committed on `seal-token-again` (`906740e`), **deployed 10 September** as
`index-V9wVdhyu` (gh-pages `899a4c3`), served bundle grepped clean, live app
verified (a room was created — anonymous auth + App Check + a Firestore write all
succeeded):

- **`src/firebase.ts`** reads the token only on the `import.meta.env.DEV` branch.
  `DEV` is a compile-time constant, so the production branch folds to `undefined`
  and the literal never enters the output.
- **`src/firebase.test.ts`** asserts the gate as text (the module cannot be
  imported under Vitest — it reads `import.meta.env` at module scope), and that
  the variable is read exactly once. Runs on every `npm test`.
- **`scripts/check-bundle.ts`** reads `.env.local`, greps every file in `dist/`
  for any value it finds there, and exits 1 naming the file if it hits. Wired
  into `deploy` between `build` and `gh-pages` (`npm run build && npm run
  check-bundle && gh-pages -d dist`). Proved both ways: a clean build exits 0, a
  token planted into a built chunk exits 1.

**`master` still has neither** (unconditional read at `src/firebase.ts:61`,
`deploy` with no `check-bundle`). Until `seal-token-again` or an equivalent lands
on master, **a deploy from master re-leaks the token.** `#40` does not fix this —
it is the rules sync, a different branch.

## The console half — still open as of 10 September

Taking the token out of the bundle does not un-publish it. It was world-readable
for weeks and must be assumed compromised. **Revoke and reissue it** at Firebase
console → App Check → Manage debug tokens. That is the half that actually closes
the hole, and it is Greg's — it needs the console.

After the reissue, the new value goes in `.env.local`. Until then `npm run dev`
and every live harness (`check-rules`, `sync-harness`, `appcheck-probe`,
`reveal-probe`, `seed-vault` uses the Admin SDK and is unaffected) authenticate
on the old token.

## Why the token isn't just removed

`npm run dev` needs it. reCAPTCHA v3 will not attest localhost and
[`localhost` must never go on the reCAPTCHA allowlist](security.md) — the site
key is public, so that would let anyone run a client against this project from
their own machine. The debug token is the supported route precisely because it
is registered per-app and revocable in one place.
