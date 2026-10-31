# PR CI speed (PROJ-93)

> **Owner: Greg Rothwell. Last updated: 31 October 2026. Budget: 250 lines.**

**Status: LIVE 31 October 2026** ([#184](https://github.com/gregjrothwell/quiz/pull/184), merge `8b9ebea`, Greg: "go live"). PR wait 8m25s → 6m11s on a cache hit; master warms the caches; pre-push hook. Brief from Alfred, 31 Oct 2026, after Greg flagged
Owen Gretzinger's post on cutting agent CI from ~40 min to ~2 min
(<https://x.com/owengretzinger/status/2116291924219060319>). Alfred's own two notes
(`claude-handover-quiz-ci-speed-2026-10-31.md`, `ci-speed-owen-gretzinger-2026-10-31.md`)
were never on this Mac; this was worked from the ticket alone.

This is about the **pull-request** wait. The go-live path (master reusing the PR's `dist`,
docs-only skip) is [`lead-time.md`](lead-time.md) and is unchanged.

## Baseline — PR run 41080509766, 30 Oct 2026: 8m25s

| Stage | Time | Notes |
|---|---|---|
| Plan | 11s | |
| Verify and build | 110s | `npm ci` 27s, typecheck 8s, lint 12s, test 33s, build 8s — in series |
| Six Playwright shards | 5m16s–6m10s | each ~55s of setup (`npm ci` 21–29s), then specs |
| Joining job | 3s | |

Every shard waited for all 110s of verify, though it needs only `dist`.

Per-spec times from that run, summed per file:

| Spec | Time | Spec | Time |
|---|---|---|---|
| commentator | 258s | double | 126s |
| slop-cannon-double | 246s | survey-says | 120s |
| host-writes | 186s | node-round | 96s |
| test-run | 150s | host-authority | 91s |
| slop-cannon | 134s | rig-probe | 30s |
| beat-the-chaser | 126s | host-authority-rules | 26s |

The rest are under 15s each. **The Commentator's 258s is the floor**: it plays a whole
round on real clocks, and no grouping makes a shard faster than its slowest spec. Going
below it means changing how long a round takes under test, which is a different job.

## What changed (#184)

1. **Verify split in two.** `Build` installs, builds and uploads `dist` and the tree
   marker. `Typecheck, lint and test` runs alongside it. The shards need `build` only.
   **`Verify and build` stays** as the job joining the two, because the ruleset requires
   that name and `rules` and `deploy` read `needs.verify.result`. The What's new and Jira
   gates moved into it.
2. **`node_modules` cached** with `actions/cache` v5.1.0 (GitHub's own action, node24,
   pinned to `caa2961`), keyed on `.nvmrc` and `package-lock.json`. The shards cache
   Chromium with it. A pull request can read master's caches but master never reads a
   pull request's, so a branch cannot plant a tree that ships. `rules` and `deploy` don't
   use the cache and keep `npm ci --ignore-scripts`.
3. **Seven shards instead of six** (`e2e/shards.json`), each filled to about the 258s
   floor and no further.
4. `e2e` (the required "Playwright against emulators") now needs `build`, not `verify`.
   A lint failure no longer hides the e2e result; verify still blocks the merge and the
   deploy.

`ci-plan.sh` needed nothing. It finds the `tree-<hash>` artefact by name and checks the
run's overall conclusion, and both still hold.

## Left out, and why

- **Oxlint, Vitest `isolate: false`.** Lint (12s) and the tests (33s) are off the critical
  path now. Making them faster would not shorten the wall clock, and `isolate: false`
  risks tests leaking state into each other.
- **Blobless checkout.** Checkout takes 5s at depth 1; nothing to win.
- **Paid or larger runners (Phase 2).** Need Greg's spending yes. Bigger runners would not
  move the floor either: the 258s is wall-clock game time, not CPU.

## Measured after — 31 Oct 2026

| | Baseline 41080509766 | Miss 41222607714 | **Hit 41223387829** |
|---|---|---|---|
| Wall clock | 8m25s | 8m35s | **6m11s** |
| Shards start at | +2m05s | +2m09s | **+49s** |
| Build (was verify) | 110s | 112s | **32s** |
| Shard setup before specs | ~55s | ~90s | **~25s** |
| Slowest shard's specs | 307s | 284s | 294s |

**The hit is the result: 2m14s off, 27%.** The shards start 76s earlier and set up 30s
faster. The rest is the spec floor.

**The miss run was worse than the baseline.** I had dropped setup-node's `cache: npm` as
redundant. Without `~/.npm`, `npm ci` fetched from the registry: 72–80s against 27s. It
is back as the fallback (`d79e3b5`). A miss with the fallback has **not been measured**.
By arithmetic it should come in around 7m20s, still saving the 76s from the split.

**When a hit happens.** Caches are scoped to the ref that saved them, and master never
builds: a merge reuses the PR's `dist` (`lead-time.md`), so master never saves a
`modules-` cache. Each PR's **first** run therefore misses, and every later push to the
same PR hits. **Fixed the same day**: Greg said yes, so a `warm` job now fills both caches
on every master push. It needs nothing and nothing needs it, so it can't hold up a deploy;
on a hit it costs seconds. `scripts/ci-speed.test.ts` fails if its keys drift from the
jobs that read them.

**Variance.** Spec times moved ±30s between runs on identical code: shard 2 was 279s,
then 294s. The re-cut is near its limit. One whole-round spec per shard would need ~10
shards to save maybe another 30s.

Storage: `e2e-` 379 MB plus `modules-` 108 MB per PR, against GitHub's 10 GB per repo,
which evicts the oldest first.

## Pre-push hook — 31 Oct 2026

Greg said yes. `.githooks/pre-push` runs typecheck, lint and the unit tests before a push
leaves the machine: 15s for the whole `git push` on its first real use (the suite alone is 6s). A failure here costs a
minute instead of a CI run. It stays quiet when green and prints the log only on failure.
It skips when the push changes only `docs/` or Markdown, matching Plan, and runs whenever
it can't tell. `SKIP_PREPUSH=1 git push` overrides it.

It's installed by the `prepare` script (`git config core.hooksPath .githooks`), which
`npm install` and `npm ci` run. Every worktree on a Mac shares the one `.git/config`, so
one install covers them all. The Mac mini needs one `npm install` of its own. Tested both
ways in `scripts/ci-speed.test.ts` against a scratch repo: a code change runs the checks,
a docs-only change doesn't.

## Live — 31 Oct 2026

Merged `8b9ebea` on Greg's "go live", after the classifier refused auto-merge as a
production deploy. Master run 41226733297: Plan reused the PR's `dist`; rules republished
(files unchanged); gh-pages had nothing new to commit, because the site's bytes are
unchanged, so it stays `b7871e4` and live is still `index-0q-ot5PS.js`. `warm` saved
master's `modules-` (108 MB) and `e2e-` (379 MB) caches at 17:55Z. **Still unmeasured:**
a new PR's first run reading those caches. The next PR is the test: its Build should show
`actions/cache` hitting and no `npm ci` step.
