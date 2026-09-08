# The build is a leak channel, and the repo being clean says nothing about it

> **Owner: Greg Rothwell. Last updated: 8 September 2026. Budget: 250 lines.**

Written after the App Check debug token was found in the deployed bundle on
8 September 2026, having been served publicly since **15 August**.

## What was wrong

`src/firebase.ts` read `VITE_FIREBASE_APPCHECK_DEBUG_TOKEN` unconditionally.
**Vite inlines every `VITE_`-prefixed variable into the bundle at build time**,
and `npm run deploy` is `npm run build && gh-pages -d dist`, run on the machine
that holds `.env.local`. So the token was compiled into the JavaScript and
pushed to GitHub Pages, where the site is world-readable.

Verified four ways rather than believed once:

1. `.env.local` defines the token, 36 characters.
2. The exact string appears in `origin/gh-pages:assets/index-BDZpMBAG.js`.
3. `curl https://gregjrothwell.github.io/quiz/assets/index-BDZpMBAG.js` returned
   it — HTTP 200, 243,405 bytes, no sign-in and no room code.
4. Rebuilding the un-gated source reproduced the hash **`index-BDZpMBAG`**
   exactly, which is what was live. The leak was not a stale artefact.

**The exposure was total.** `scripts/appCheck.ts` documents the
`exchangeDebugToken` call, and all three of its inputs were in that same public
file — the API key and app id are public by design, the token is not. The
exchange returns a real App Check token from any machine, any IP, refreshable
indefinitely. App Check is enforced on Firestore, the RTDB **and** auth, so all
three were open.

**Traced across all 46 gh-pages commits:** first in `51d3186`, 15 August 2026,
and in every one of the 16 deploys since — 24 days.

## The two dates, which are the point

The security review was **15 August**, the same day, and it declared secrets
verified clean. That was **true, and about the repo**: nothing sensitive has
ever been committed on any branch, re-verified across all history on 8
September. `.gitignore` covered `.env.local` and did its job perfectly.

**App Check went enforcing on Firestore on 16 August** — the day after the token
went public. It has never actually been the control the other documents describe.

> **Every audit scoped itself to `master`. The leak channel was the build.**

That is the transferable finding, and it is why this file exists rather than a
line in [`security.md`](security.md). A repo-clean check and a bundle-clean check
are different checks, and passing the first says nothing about the second.

## What was done, 8 September 2026

- **The read is gated** behind `import.meta.env.DEV` (`src/firebase.ts`), a
  compile-time constant, so the production branch folds to `undefined` and the
  literal never reaches the output. Node scripts are unaffected —
  `scripts/appCheck.ts` reads `process.env` on its own path.
- **`src/firebase.test.ts`** asserts the gate on every `npm test`. Cheap half.
- **`npm run check-bundle`** greps the built artefact and sits between `build`
  and `gh-pages` in `deploy`, so a build carrying a secret **cannot be
  published**. Expensive half, and the one that looks at the thing that leaked.
- **The token is revoked and reminted** by Greg in the console. A revoked token
  is inert wherever it sits, which is why gh-pages history is **left alone**:
  rewriting it would be a force-push against the never-rewrite rule, to remove a
  string that no longer opens anything.

## Proved in both directions

A guard nobody has watched fail is not a guard.

- Gate removed → `firebase.test.ts` fails 2 of 4; restored → 4 pass.
- Gate removed → `check-bundle` names the file and **exits 1**; restored →
  *"dist/ is clean: 1 secret(s) checked against 77 file(s)"*, exit 0.
- **The grep was cross-checked before its silence was trusted.** "Token absent
  from `dist/`" means nothing if the search is broken, so the same grep was run
  for `VITE_FIREBASE_API_KEY` — **present**, as it should be. The instrument
  finds things; the absence is real.
- **One assertion was caught being vacuous.** `expect(READ).toContain('undefined')`
  passed on the *un-gated* source too, because the declared type is
  `string | undefined`. Only forcing it red exposed that; it is now
  `toMatch(/:\s*undefined;/)`, the ternary's else branch. This is the exact shape
  of assertion that looks like a guard and is not one.

## What this does not cover

- **`check-bundle` only knows what is in `.env.local`.** A secret introduced any
  other way is invisible to it. The `FORBIDDEN` list is explicit and hand-kept.
- **It deliberately does not flag** the API key, app id, project id or reCAPTCHA
  site key. Those are public in every Firebase web app that ever shipped, and
  the rules are what protect the project. Flagging them would make this noisy
  enough to be ignored, which is worse than not having it.
- **The reCAPTCHA allowlist is console state** and cannot be read from the repo.
  Say *unverified*, not *verified clean*.
- **An E2E runner is the obvious way this recurs.** Playwright or any CI that
  needs to attest would want a debug token in the environment, and that is the
  same mistake with a different filename. Give it the emulator instead.
