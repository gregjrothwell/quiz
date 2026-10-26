# Firebase emulators for Playwright

> **Owner: Greg Rothwell. Last updated: 25 October 2026. Budget: 250 lines.**

Playwright talks to the Firebase emulators, never the live project, never an App
Check debug token. The switch is a runtime flag on `window`, not a Vite env var.

**Verified, 10 September 2026.** `npm run e2e` against a production `dist/`:
landing enabled after anonymous auth on the Auth emulator, then a four-character
room code from a Firestore write. Two tests, Chromium, OpenJDK 21. Still not a
fifteen-question round — the vault is empty, and that is the next gap.

## Why a runtime flag, not a build-time `VITE_*`

CI e2e drives the **exact production `dist/`** that is about to ship (`needs:
verify`, download the artefact, `vite preview`). That bundle is a production
build: `import.meta.env.DEV` is false, so the debug token is not inlined.

A build-time emulator flag would do one of two things, both wrong:

1. **Bake emulator hosts into the artefact.** The thing Playwright tested would
   not be the thing that ships — or worse, production would point at localhost.
2. **Build twice**, once with the flag and once without. Two builds are two
   chances for the shipped bundle to differ from the checked one. That is the
   failure [`ci-deploy.md`](ci-deploy.md) already refused.

So Playwright (and only Playwright) sets `window.__QUIZ_EMULATORS__ = true`
via `addInitScript` **before** the app loads. `src/firebase.ts` `connect()`
reads that flag. `npm run dev` does not set it. Live github.io does not set it.

The flag is boolean `true` only (`emulatorsWanted` is `=== true`, not truthy).
Same class of bug as the debug token: the SDK treated `'true'` as a token.

There is no `VITE_` variable for this. `check-bundle` refuses a build if any
GitHub workflow so much as names `VITE_FIREBASE_APPCHECK_DEBUG_TOKEN`. A
similarly-shaped env var for emulators would look like a way to put a debug
token back in CI. Don't add one.

## Why the host is hardcoded

`EMULATOR_HOST` is the literal `127.0.0.1` in `src/lib/emulators.ts`.
`connect()` does not read a host from the page. An XSS that could set the
emulator host would redirect Firebase at an attacker.

The Auth URL is built in `authEmulatorUrl()` so `firebase.ts` does not
concatenate one ad hoc.

## Why `npm run dev` does not use emulators

Local play still uses the debug token against the live project. That is
deliberate. The emulator path exists so Playwright can drive a production
bundle without a debug token and without touching `quiz-d686e`. Pointing
`npm run dev` at the emulator would make "does this work" mean something
different on a laptop than on github.io, and it would need the JDK up for
ordinary play.

## Why App Check is skipped under the flag

The emulators do not enforce App Check. Loading reCAPTCHA on `127.0.0.1` would
fail — localhost is not on the allowlist, and must not be. `connect()` therefore
does not call `initializeAppCheck` when `emulatorsWanted()` is true.

When the flag is missing, behaviour is unchanged: live Firebase, App Check with
reCAPTCHA (or the DEV-gated debug token).

## Ports

| Product | Port |
|---|---|
| Auth | 9099 |
| Cloud Firestore | 8080 |
| Realtime Database | 9000 |

Host `127.0.0.1` on each. UI disabled — CI does not need it. `singleProjectMode`
true. Rules files are the live ones: `firestore.rules` and
`database.rules.json`. Not `firestore.seed.rules`. The vault stays
`allow read, write: if false`.

`.firebaserc` default is `quiz-d686e`. The emulators never contact Google; the
production bundle inlines this project id, so the emulator project name must
match or Auth/Firestore look like a different app.

## Java

The Firestore emulator is a Java process. CI installs Temurin 21 with
`actions/setup-java@v5`. That major is the first that declares `node24`; do not
use `@v4` — it is the same trap as `checkout@v4` / `setup-node@v4` in
[`ci-deploy.md`](ci-deploy.md). Local `npm run e2e` needs a JDK 21 on `JAVA_HOME`.

`npm run emulators` starts Auth / Firestore / RTDB without the UI.
`npm run e2e` is `firebase emulators:exec` wrapping Playwright against `dist/`.

## Playwright's contract

The Playwright agent writes the test. The contract it has to keep:

```
page.addInitScript(() => {
  window.__QUIZ_EMULATORS__ = true;
});
```

before the production bundle loads. Not a query string, not `localStorage`, not
a `VITE_` flag. `src/lib/emulators.ts` is pure (no React, no `import.meta.env`,
no Firebase) so the test file can import `EMULATOR_FLAG` / `EMULATOR_PORTS`
without pulling in `src/firebase.ts`.

## Each spec starts from an empty emulator — 23 October 2026

The spec files share one emulator. In CI they run one after another; locally the
default was half the cores, so files ran together. On 22 Oct, Survey Says waited
for three season rows named Host, Ann and Bob and found six, left by an earlier
file. `e2e/isolate.ts` wipes Auth, Firestore and the RTDB before each spec's own
`beforeAll`. `playwright.config.ts` sets `workers: 1`, because a second worker
would wipe a file that is still playing. Not live: this is the test runner, not
the site.

## Four shards in CI — 25 October 2026

One worker made CI's e2e 18–21 minutes on every PR from 23 Oct (2.6–3 min on
22 Oct morning; ~10 min that evening, as the whole-round specs landed). Run
40151240593: 1,159s of specs, 1,178s for the step, Commentator 259s, host-writes
199s, Beat the Chaser 134s, double 128s, Survey Says 126s.

CI now runs four jobs at once (`e2e-shard`), each on its own runner with its own
emulators, so the wipe can never hit another shard. The groups are
`e2e/shards.json`, balanced by those times to ~290s each. Inside a shard it is
still one worker. **"Playwright against emulators" is now a gate job** that
fails unless every shard passed: the ruleset requires that name, and a matrix
reports under others. `scripts/e2e-shards.test.ts` fails if a spec is in no
group or the matrix does not list every group — a spec in no group would
otherwise never run in CI. Add a new spec to the lightest group.

**26 Oct: five shards, and no apt** (#154, `c1ee8a6`). `slop-cannon.spec.ts`
went into shard 0 unmeasured: three browser rounds, ~6 min, took that shard's
specs from ~300s to 677s, and the gate waits on the slowest. It has a shard of
its own. **Time a new spec locally before choosing its group**; one with whole
rounds in it may need a shard of its own. Separately, `playwright install
--with-deps` spent 520–637s on 3 of 5 runs that day fetching 25.9 MB of fonts
from azure.archive.ubuntu.com, with every Chromium library already installed.
Now `playwright install chromium` plus a launch probe, apt only if it fails.
First run after: install 7–10s, probe 0–1s, shards 0–3 350–373s, shard 4
472s, ~9.6 min to green (from 12+, or a timeout).

Locally `npm run e2e` is unchanged: every file, one worker. In zsh, `$files`
does not word-split; the CI step is bash.

## What this does not cover

- **Seeding the vault.** Emulator Firestore starts empty. A round that needs
  answers still has to get them in somehow; that work is not this.
- **A full 15-question round.** Not run.
- **App Check enforcement.** The emulators don't. `appcheck-probe` against live
  is still the proof that unattested clients are refused.
- **The live project.** Playwright must not be given credentials that can reach
  it. Local `npm run dev` still does, via the debug token, on purpose.
