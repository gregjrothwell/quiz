# Moving to Cloudflare and a private repo — what it would cost

> **Owner: Greg Rothwell. Last updated: 25 November 2026. Budget: 250 lines.**
> **Status: PROJ-153. Greg, 25 Nov 2026: "cloudflare but no rush (analyse implications)", then on this analysis: "your pick but
> leave for now". So C first, Cloudflare with W4's own address, and neither is started. Nothing changed.**

## The short version

**It works, and hosting is the easy part.** Three things cost more than the hosting does:

1. **Every player becomes a stranger.** Identity lives per web address. A new address means a new
   season row for everybody unless a handover is built first: 2 of 32 rows have a recovery code.
2. **CI stops being free.** A private repo pays for minutes: **3,781 in the last month**, against 2,000
   included on GitHub Free.
3. **GitHub Free drops two guards on a private repo**: the `jira` and `github-pages` environments
   (master-only secrets), and maybe the `master` ruleset.

**The goal is to stop the answers being readable. Two smaller moves do that with no new address** (see
"Three ways to the same goal"). Recommendation: do C now, A when the public league (W4) needs its own
address anyway, because that is the day the address changes regardless.

## What the move is for — verified 10 Nov (PROJ-153), re-counted 25 Nov

The site is clean: `public/packs/` holds no answer and `seal.test.ts` keeps it so. The leak is the
generator source beside it, about 2,300 answer lines in the tracked `scripts/hand-*-data.ts` files. The
repo also names colleagues with their timings. 0 forks and 0 stars on 25 Nov. **Going private stops
future reading and takes nothing back**: anything already cloned or cached stays out.

## Three ways to the same goal

| | A. Cloudflare + private repo | B. GitHub Pro, private repo, stay on Pages | C. Stay public, move the answer sources to a private repo |
|---|---|---|---|
| Hides the answers | Yes | Yes | Yes |
| Hides the names, the docs, the known weaknesses | Yes | Yes | **No** |
| Address | **New** | Same | Same |
| Player identities | **Lost without a handover** | Kept | Kept |
| App Check and Firebase allowlists | Change | No change | No change |
| CI minutes | About $11 a month over | About $5 a month over, plus Pro | Free |
| Environments, branch limits | Lost on Free | Kept on Pro | Kept |
| Header CSP, previews, instant rollback | **Yes** | No | No |
| Size (estimate) | 2–3 sessions | Under 1 | 1–2 |

*B is verified for Pages on private repos and for environments (GitHub docs, 25 Nov). The price of Pro was
not read (placeholder). "A needs Free" is an assumption: A with Pro gets the environments and B's minutes.*

**C is the one not considered before.** It was turned down on 4 September because moving the specs "out of
the repo makes the packs unregenerable" ([`known-limits.md`](known-limits.md)). That was about a gitignored
cache, which one `rm` loses. A private repo beside this one is versioned and backed up, so the objection
does not hold. `write-*-pack` would read its specs from a sibling checkout. What C has to solve: **at least ten test
files import a spec file**, two of them under `src/` (`grep -rlE "hand-[a-z]+-data'" scripts src
--include='*.test.ts'`), and CI could no longer see one, so those checks would run locally and not in CI.
That is a real loss and the main argument against C. `melody-voices.ts` is under `src/` too.

## What breaks in A, in the order it would hurt

### 1. Identity — the one that needs building

- A season row belongs to a `playerId`, which defaults to the anonymous Firebase uid
  ([`identity.md`](identity.md)). The uid lives in IndexedDB and `vibequiz.playerId` in localStorage
  (`src/lib/identity.ts`). **Browsers keep both per origin**, so at a new address every browser is a new
  player: new row, no form, no rosettes, no rivals, no streak, no finals.
- Also left behind, less painful: the remembered name and squad, sound and volume, the What's new marker.
- **There is already a way across: the recovery code.** A player who has one types it at the new address,
  and `claims/{uid}` plus `foldRecords` do the rest. **Counted 25 Nov: 2 of 32 season rows have a code, 2 of the
  13 who played three or more rounds in 30 days, and no browser holds a claim** (`claims/` is empty). So 11 of 13
  regulars would lose their record, and the path across is unproved by any player.
- **The handover that would not need the player to type anything (design, not built):** keep the old address
  alive as a page that mints a recovery code for this browser's own identity (allowed: `ownsPlayer` on
  `recovery` create) and redirects to the new address with the code in the URL *fragment*, where the new site
  claims it and clears it. No rules change expected. The fragment is never sent to a server.
- That page has to be served from `gregjrothwell.github.io/quiz/`. With the `quiz` repo private on Free, Pages
  unpublishes it, so it would come from a second small public repo (`gregjrothwell.github.io`, folder `quiz/`).
  It must load the Firebase SDK under App Check, so the old domain stays on the allowlist until it is retired.

### 2. CI minutes — measured 25 Nov 2026

138 runs since 25 October, **3,781 job-minutes** rounded up per job as GitHub bills them: 3,586 on pull
requests and 195 on pushes to `master`. A code PR costs about 53 (eight Playwright shards). Linux 2-core is
$0.006 a minute and Free includes $12 a month, Pro $18 (GitHub docs, 25 Nov): so **about $22.70 used, $10.70
over on Free**, $4.70 on Pro. Docs-only PRs are already nearly free. Cheaper first: fewer shards (it was built
for latency, [`ci-speed.md`](ci-speed.md)), or Playwright on the release PR only. A spending limit of $0 would
**stop CI mid-month**, and with it every deploy and every rules publish.

### 3. What GitHub Free takes off a private repo

- **Environments and their secrets: public repos only on Free** (GitHub docs, 25 Nov). `JIRA_EMAIL` sits in
  the `jira` environment, limited to `master`; `github-pages` likewise. As plain repo secrets they would be
  readable by any branch's workflow. Pro keeps environments and branch limits.
- **The `master: require CI` ruleset**: GitHub's page does not say what Free does on a private repo.
  **Not verified**; check before flipping, because it is what keeps a red PR off `master`.
- **Rules publishing survives, with care.** The Google trust is pinned to `repository_id` and `master`
  ([`rules-from-ci.md`](rules-from-ci.md)), not to the name or the visibility. Flipping the *same* repo to
  private keeps the id. **A new repo gets a new id, and rules publishing dies until gcloud is changed.**

### 4. Allowlists that name the address

| Where | Change | Who |
|---|---|---|
| reCAPTCHA key behind App Check | Add the new domain, keep the old for the handover | Greg, console |
| Firebase Auth, authorised domains | Add it. Anonymous sign-in may not need it: **not verified** | Greg, console |
| API key referrer limits, if any are set | Add it: **not checked** | Greg, console |
| This repo | `vite.config.ts` `base`, `package.json` homepage, `playwright.config.ts`, `scripts/freshness.ts`, `scripts/rank-harness.ts`, and tests that spell the URL | Agent |
| The office link, the Teams post, bookmarks | Re-share | Greg |

**Never allowlist `pages.dev` loosely.** Preview addresses are `<hash>.<project>.pages.dev` and public by
default (Cloudflare docs, 25 Nov). If the key's domain entry covers subdomains, every preview build of every
branch talks to the **live** project. Previews should run on the emulators or not at all.

### 5. The office network

`*.pages.dev` is a free-hosting domain, and web filters often treat those harshly (**general knowledge, not
checked here**). **Test from an office machine before anything else**, with a placeholder page. A custom
domain avoids the question, costs a few pounds a year, and means never changing address again.

## What A gives that Pages does not

- **A real header CSP** (`_headers`), so item 6 in the handover's Outstanding list goes. The
  `<meta>` version was turned down because it breaks silently.
- **Instant rollback.** Pages has hung at `building` twice (21 Oct, 6 Nov). It does *not* fix the stale chunk of
  28 October by itself: a deploy that replaces the old files is the cause there (`src/lib/staleChunk.ts`), and
  whether Cloudflare keeps serving the previous deploy's files was **not checked**.
- **Size is no obstacle**: 911 files and 93MB in `public/`, none over 1MB, against 20,000 files and 25MiB
  each on the free plan. Requests for static files are free.
- **Cloudflare now says "Start new projects with Workers"** (its Pages page, 25 Nov). Workers static assets
  is the one to build on; the two existing sites are on Pages and can stay there.

## What does not change

Firestore, the RTDB, App Check, the vault and the rules. A room that is open during the switch is in Firebase
and not on the host, so it survives. A tab on the old bundle keeps working until it reloads.

## If it is A, the order

1. Test a placeholder on the office network. (Recovery codes are counted, above.)
2. Decide the address: custom domain or `pages.dev`. Only one move should ever happen.
3. Deploy the same bundle to Cloudflare beside Pages, with the base path moved to `/`. Add the domain to
   the allowlists. Prove App Check **both ways**: the new site plays a round, and `appcheck-probe` is still refused.
4. Build and prove the handover, on two browsers, one claimed and one not.
5. Move the office link. Leave both up for two weeks.
6. Flip the repo to private. Same day: `check-rules`, one CI deploy, one rules publish.
7. Retire the old address last.

Steps 1 to 5 can be undone. Step 6 unpublishes Pages at once on Free, so it waits for 5.

## Decisions — Greg's

1. **C now and A with W4, or A on its own?** Recommended: C now. **Greg, 25 Nov: C and then A, but not yet.**
2. **If A, Pro or Free?** Pro keeps the guards and adds $6 of minutes.
3. **If A, a custom domain?** Recommended, for the office filter and so the address never moves again.

## Sources, read 25 November 2026

[GitHub: environments](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments) ·
[GitHub: plans](https://docs.github.com/en/get-started/learning-about-github/githubs-plans) ·
[GitHub: Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions) ·
[GitHub: rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets) ·
[Cloudflare: Pages limits](https://developers.cloudflare.com/pages/platform/limits/) ·
[Cloudflare: Pages](https://developers.cloudflare.com/pages/) ·
[Cloudflare: preview deployments](https://developers.cloudflare.com/pages/configuration/preview-deployments/) ·
[Cloudflare: headers](https://developers.cloudflare.com/pages/configuration/headers/)
