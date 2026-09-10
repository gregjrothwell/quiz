# Deploy from CI, not a laptop

> **Owner: Greg Rothwell. Last updated: 10 September 2026. Budget: 250 lines.**
> **Status: proposed, not built.** A loose outline for a follow-up session. The
> local guard (`scripts/predeploy.ts`) is the interim; this is the durable fix.

## Why

`npm run deploy` builds locally and pushes `dist/` to `gh-pages`. It runs on a
laptop that holds `.env.local`, off whatever branch is checked out. The App Check
debug token reached production twice through exactly that —
[`debug-token-leak.md`](debug-token-leak.md). The two failure modes:

1. **The build machine has the secret.** Vite inlines every `VITE_` var; if the
   token is in `.env.local` it can end up in the bundle.
2. **The deploy ref is whatever's checked out.** The gate that keeps the token
   out has twice been on a branch that wasn't the one deployed.

CI kills both. A CI runner has no `.env.local`, so the debug token is not on the
build machine — inlining it is impossible, not merely guarded. And CI deploys
from one ref (`master`), so "what shipped" is always "what was reviewed".

## Shape

GitHub Actions. This repo has no `.github/` yet — this is the first workflow.

**Trigger:** push to `master`, plus `workflow_dispatch` for a manual re-run.

**Job:**
```
checkout
setup-node (match .nvmrc / package.json engines if set; else Node 20)
npm ci
npm run typecheck
npm run lint
npm test              # stays offline — no Firebase, no network
npm run build
<secret scan of dist/>   # see below
deploy dist/ to gh-pages
```

**Secret scan** — `check-bundle.ts` reads `.env.local` to know what to grep for,
and CI has none, so it now exits 1 under `CI` rather than passing blind. Options
for CI, in order of preference:

- **gitleaks** (`gitleaks/gitleaks-action` or the binary) pointed at `dist/`. It
  has its own detectors — UUID-shaped tokens, high-entropy strings — and needs no
  secret value. Tune its config to ignore the *public* Firebase keys, which are
  meant to ship.
- Pass the forbidden values into `check-bundle` from a CI secret
  (`APPCHECK_DEBUG_TOKEN` as an Actions secret, read via a new
  `CHECK_BUNDLE_FORBIDDEN` env the script would need to learn). Puts the secret
  in CI, which is the thing we're trying to avoid — only do this if gitleaks
  proves noisy.

**Env at build time** — only the values that are *supposed* to ship, as Actions
**variables** (not secrets; they're public):

```
VITE_FIREBASE_API_KEY            VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID         VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID VITE_FIREBASE_APP_ID
VITE_FIREBASE_DATABASE_URL       VITE_FIREBASE_APPCHECK_SITE_KEY
```

**Never add `VITE_FIREBASE_APPCHECK_DEBUG_TOKEN` to CI.** That absence is the
whole mechanism. The `import.meta.env.DEV` gate already folds it to `undefined`
in a production build; CI not having it at all is the belt to that braces.

## Pages config

Currently `build_type: legacy`, serving the `gh-pages` branch (`gh api
repos/gregjrothwell/quiz/pages`). Two ways:

- **Keep `gh-pages`.** The workflow runs `peaceiris/actions-gh-pages` (or
  `gh-pages` npm) to push `dist/` there. Smallest change; `npm run deploy` and CI
  produce the same artefact the same way.
- **Switch to Actions-native Pages** (`actions/deploy-pages`). Cleaner, no
  `gh-pages` branch, but it's a repo-settings change and a different deploy
  primitive. Do this only if the branch approach bites.

Start with keep-`gh-pages`.

## What to retire

- **Local `npm run deploy`** — either delete it, or make it refuse unless
  `DEPLOY_FROM_BRANCH=1` (rename the intent: "I know I'm deploying by hand").
  `scripts/predeploy.ts` already gates it to master + clean + level; once CI
  exists, the hand path is the exception, not the norm.
- **PR #35** (`seal-the-debug-token`) — the first, superseded fix. Close it.

## The discipline this forces

Deploys come from `master`, so **`master` has to be current** — PRs merged before
they're relied on. Right now deploys come off feature branches *because* merging
waits on Greg and the harness won't `gh pr merge`. That has to change: merge via
the GitHub UI, or branch protection + auto-merge. It's the
[`PLAN-BUILD`](../../CLAUDE.md) default flow anyway (branch → PR → review → merge
→ deploy).

## Out of scope

- The live-Firebase harnesses (`check-rules`, `sync-harness`, `reveal-probe`,
  `host-room`, `rank-harness`) stay **local**. They need the debug token and they
  talk to the live project — they are not part of a deploy and must not run in
  CI against production.
- A **scheduled** workflow (daily cron) that curls the live bundle and greps for
  secret shapes would catch an out-of-band hand deploy within a day. Cheap
  follow-on once the deploy workflow exists; not required for v1.

## First move

Merge the branch that carries the gate + `check-bundle` + `predeploy.ts` so
`master` is safe to deploy from, *then* build this on top.
