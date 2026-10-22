# Go-live lead time

> **Owner: Greg Rothwell. Last updated: 22 October 2026. Budget: 250 lines.**

**Status: built on `ci-lead-time`, stacked on #111. Not live.** Greg, 22 October
2026: *"Go live time is unacceptable"*, then *"Yes: build the CI speed-ups (reuse
the PR's dist, docs-only skip) after #111 lands, and change the release-branch
rule to two or more features only. I'll turn on auto-merge and the required
checks."* The earlier measurement and the first cuts are in
[`ci-deploy.md`](ci-deploy.md#lead-time-measured-2-october-2026--word-go-to-live-in-43-minutes).

## Measured — #110, 22 October 2026

Greg said go at about 06:43 UTC; live at 06:59:10. About 16 minutes.

| Step | Time | Needed? |
|---|---|---|
| Release branch and PR #110 | ~2 min | Only because of the release branch |
| #110's CI, 06:45:01 → 06:49:32 | 4m31s | **No.** #109 was already running CI on the same tree |
| Claude holding the merge for two `check-rules` runs | ~3 min | **No.** No rules had changed, so it belonged after the merge |
| Master verify and e2e, 06:52:36 → 06:56:47 | 4m11s | **No.** Byte-identical to #110's tree |
| Rules 38s, gh-pages 60s, Pages build 45s | 2m23s | Yes |

Then the docs-only record PR (#112) cost a second full CI and deploy, about
10 minutes, for no change to the site.

## What changed

1. **A Plan job runs first** (`.github/scripts/ci-plan.sh`). It outputs:
   - `code=false` when every changed path is documentation: `docs/**`, or
     `*.md` outside `public/` (Vite ships `public/packs/ATTRIBUTION.md`).
     Verify, e2e, rules and deploy all skip, so a docs PR is green in seconds
     and a docs merge deploys nothing.
   - `reuse_run=<id>` on a push to master, when a passed pull-request run has
     already built **this exact tree**. Verify and e2e skip; rules publishes
     from master, and deploy downloads that run's `dist`. `check-bundle` still
     runs on the reused bytes before they ship.
2. **Every PR run's verify uploads a marker** named `tree-<hash>`, holding
   `git rev-parse HEAD^{tree}` of what it built. It is kept as long as `dist`
   (7 days).
3. **AGENTS.md:** a release branch only when two or more features go live
   together. One feature goes live from its own PR.
4. **Greg's settings:** *Allow auto-merge* is on (22 Oct). A rule on `master`
   requiring the checks is still to do (below).

## Why it is built this way

- **Tree, not commit.** The plan first tried "the merge's second parent, and its
  PR run". GitHub empties a run's `pull_requests` list once the PR is merged,
  which is exactly when master asks, so the base branch could not be checked
  (`gh api …/runs/39735898550` on 22 Oct: `"pull_requests": []`).
  - A marker named after the tree a run *actually built* needs no PR metadata.
  - It works for a merge commit and a squash alike.
  - It fails safe: if master moved between the PR run and the merge, the trees
    differ, nothing matches, and everything runs.
- **Forks cannot plant a build.** A fork's PR runs its own copy of the
  workflow, so it can name an artefact `tree-<anything>`. Plan therefore
  accepts a run only if it is:
  - `pull_request`, `success`, and `.github/workflows/ci.yml`;
  - from a head repository that is this one, and pushing a branch here needs
    write access.
- **A skipped job is a passed required check.** GitHub, "Troubleshooting
  required status checks", read 22 Oct: a job skipped by `if` "reports
  Success"; a workflow skipped by a path filter leaves checks "Pending". So:
  - The docs skip is a job-level `if`, never `paths-ignore`.
  - **If Plan fails, verify and e2e run in full.** Verify's `if` skips only when
    Plan *succeeded and* said skip. e2e uses `!cancelled()`, so a failed Plan
    cannot leave a skipped e2e passing the gate.
- **Auto-merge needs required checks.** GitHub's auto-merge docs, read 22 Oct:
  the option "is shown only on pull requests that cannot be merged
  immediately", and it merges "after all required reviews and status checks
  pass". `master` has no protection and no ruleset (`gh api …/rulesets` → `[]`),
  so `gh pr merge --auto` would merge at once, untested. **Not used until the
  rule exists.**

## For Greg — the rule

Settings → Rules → Rulesets → New branch ruleset:
- target `master`;
- *Require status checks to pass*, requiring **Verify and build** and
  **Playwright against emulators**, the job names in `ci.yml`.

Leave *Require a pull request* off unless you want it. CI's gh-pages push goes
to `gh-pages`, not `master`, so the rule does not touch the deploy.

## Expected

Go on an already-green single PR, then auto-merge, then master's Plan finds the
PR's build. Master then runs Plan ~15s, rules ~40s, deploy ~60s and Pages ~45s:
**about 2½ minutes to live.** A docs PR goes green in about 15 seconds and
deploys nothing.

## Evidence, 22 October 2026

`ci-plan.sh` run locally against real history:

| Input | Output | Right? |
|---|---|---|
| push `2905df7` (#110) | `code=true`, no reuse | Yes: no run before this change uploaded a marker |
| push `e86e07b` (#112), `f2b6482` (#108) | `code=false` | Yes: docs only |
| push `9bab66d` (#107), `627d5f9` (#104) | `code=true` | Yes |
| PR #109, #110 | `code=true` | Yes |
| PR #112 | `code=false` | Yes |
| `workflow_dispatch` | `code=true`, no reuse | Yes |

The positive reuse case is proved against this PR's own run below, once its
verify job has uploaded a marker.

## Not covered

- **The first real reuse on master.** In particular, the cross-run download
  with the job's own token (`actions: read`) is proved only by the first merge
  after this lands. If it fails, deploy fails and nothing is published. The
  fallback is `workflow_dispatch` on master, which always runs in full.
- **Whether the ruleset blocks the deploy push.** It shouldn't: the rule
  targets `master`, and the deploy pushes `gh-pages`.
- **Playwright is slower than on 2 October:** 2m55s–3m01s, against 1m23s then.
  Not investigated.
