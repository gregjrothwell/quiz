# TOTAL-RECALL

> **Owner: Greg Rothwell. Last updated: 10 September 2026. Budget: 300 lines.**

The dated spine. Newest first, a few lines per entry. When one needs more room
than that it moves to `decisions/<topic>.md` and the entry here keeps a pointer —
depth goes outward, chronology stays central.

Append; do not rewrite an earlier entry to make it look as if we always knew. A
correction is a new dated note that says what changed, and the wrong claim stays
visible.

**Split on 28 August 2026**, at 474 lines against a 300 budget. Everything up to
and including 20 August moved *verbatim* to
[`recall/2026-08.md`](recall/2026-08.md) — not reworded, because compressing an
old entry to make it fit is the thing the paragraph above forbids. Every one of
them is still listed below by date, so the chronology reads end to end from here.

**Split again, written 4 September 2026 and landed on the 8th.** The two
2 September entries went to [`recall/2026-09.md`](recall/2026-09.md) and 29
August joined [`recall/2026-08.md`](recall/2026-08.md), which is why that file is
no longer titled "up to 28 August". Same rule, same reason: moved whole, not
shortened.

It was cut at 350 lines and sat unmerged for four days while the spine grew to
360, so **the original note's own numbers were out of date by the time it
landed** — recorded rather than quietly fixed, because a split that describes
the wrong file is the thing this document exists to stop. The link check was
re-run on the 8th against the files as they actually are, not inherited from the
4th.

**Split a third time, 8 September 2026**, at 288 with two entries about to land
— this one and PR #31's — that would have taken it past 300. The three oldest 4
September entries (the CDN, the mute button, the steal) went to
[`recall/2026-09.md`](recall/2026-09.md), whole, links repointed.

**Then repeatedly through 10 September**, each recorded as a dated pointer in the
body where it happened rather than here: three 4 September batches, then the
whole 2026-09-08 day when the debug-token deploy needed the room. All verbatim to
[`recall/2026-09.md`](recall/2026-09.md).

## 2026-09-10 — The season form ranking was live, then silently reverted

`rankByForm` shipped 8 September as `index-Df9CfP0K`. The 10 September deploys
came off `seal-token-again`, which does not contain it, so **the season board
has been ranking on raw points ever since and nobody was told**. Found by
diffing the live tree against the branches rather than by reading: the two
8 September entries below it had also never reached `master` in any form, spine
or archive, and are now in [`recall/2026-09.md`](recall/2026-09.md) verbatim.

Nothing was broken by the revert — live `formOk()` treats `form` as optional, so
banks kept working — which is exactly why it went unnoticed for two days. **This
is the failure deploy-from-CI exists to stop**, and it is the reason the restore
rides in on the same session as the workflow.

Restored on `restore-season-form`. **The board is short until each existing row
banks once**: `orderBy('form')` excludes documents without the field, and all 26
`season-2` rows predate it. Same as 8 September, and still no backfill.

## 2026-09-10 — Deploy guard added; CI outlined for later

The interim half of "fix this going forward". `scripts/predeploy.ts` runs first
in `npm run deploy` and refuses unless on `master`, tree clean, level with
`origin/master` — `DEPLOY_FROM_BRANCH=1` relaxes the ref checks for a hotfix,
tree-clean always stands. Pure `evaluateDeployRef` with a test both directions
(the allow case is the one that proves it discriminates). `check-bundle` now
exits 1 under `CI` when it has no `.env.local` to grep against, instead of
passing blind. All on `seal-token-again`; 837 tests green.

The durable fix — deploy from CI so the token is never on the build machine — is
outlined in [`decisions/ci-deploy.md`](decisions/ci-deploy.md) for a follow-up
session. Not built.

## 2026-09-10 — Token revoked and reissued; leak closed

Follows the entry below, which was written while it was still open. Greg revoked
the old debug token in the console and reissued; `.env.local` holds the new one.
Verified: live site plays via the real reCAPTCHA path (room created, no errors),
`sync-harness 3` accepts the new token, `appcheck-probe` still refused, and
`sync-harness` with a non-safelisted token gets `exchangeDebugToken` 403 — the
same path a revoked token now takes. **`master` still re-leaks on deploy** until
`seal-token-again` lands; that is the only piece left.

## 2026-09-10 — Live: the debug-token gate (`index-V9wVdhyu`), and #40 for the rules

Greg said run it. `npm run deploy` from `seal-token-again` — `build`,
`check-bundle` clean, `gh-pages`. gh-pages `9ba0638` → `899a4c3`, CDN swapped
`index-C3jZR3XU` → `index-V9wVdhyu` on the second poll. **Served bundle grepped
for the token: 0 hits across all four JS chunks, was 1.** Live app verified —
created a room, so anonymous auth + App Check attestation + a Firestore write all
worked, no console errors. Firebase chunk unmoved (`firebase-Cns3pSRr`).

**The console half is still open** — the token was world-readable for weeks and
the deploy does not un-publish it; revoke + reissue is Greg's. And **`master`
still re-leaks on deploy**: the gate and `check-bundle` are on `seal-token-again`,
not master. Full story now in
[`decisions/debug-token-leak.md`](decisions/debug-token-leak.md).

`sync-rules-with-console` pushed and opened as
[#40](https://github.com/gregjrothwell/quiz/pull/40). `npm run check-rules`
against live: **both directions green**, the `wager` and `firstMs` allow cases
FAIL → PASS, the `elapsedMs` floor proved both ways. `npm run sync-harness 10`:
**10/10 in the room, 0 missed the question.**

## 2026-09-10 — Correction: the console was ahead of the repo, not behind

The entry below says the live ruleset is behind `firestore.rules` and needs a
console paste. **That is wrong, and acting on it would have deleted a live
anti-cheat.** Left standing rather than edited, per the rule at the top.

Read the live ruleset back through the Firebase Rules API: **39,218 bytes live
against master's 34,889.** The extra is the `elapsedMs` arrival floor —
`arrivalOk`, `answerRoom`, `elapsedGraceMs`. **Both** files already list
`wager` and `firstMs` in the answers `hasOnly`, so the field I named as missing
was never missing; I read the failure hint instead of the ruleset.

Live is **byte-identical** to `firestore.rules` on the local branch
`paste-seasons-and-elapsed` — pasted 8 September, never pushed, never merged.
So the two `check-rules` FAILs were the **checker** being stale: it writes
`elapsedMs: 10` into a room whose `openedAt` is tens of seconds old by then,
and the floor correctly refuses it. **The failing checks were the rule
working.** That same branch had already updated the checker.

`sync-rules-with-console` (off master, **local, unpushed**) takes
`firestore.rules` + `check-rules.ts` from it. Result: *"Both rulesets are live,
and still refusing what they should"* — the two allow cases FAIL → PASS, and
the floor proved both ways. No match block lost.

Also checked, because today's deploy came off master: **it did not revert the
season-form work.** The league board reads "Average" in `index-C3jZR3XU` and in
`index-CFub7zgz` alike, so `rankByForm` has been off master since 9 September.
It was live for one day as `index-Df9CfP0K`.

## 2026-09-10 — Live: volume, clip cuts, 177 songs (`index-C3jZR3XU`)

Seeded first: **95 added**, then after the slug fix **4 added, 1 changed**.
`npm run deploy`; gh-pages `9ba0638`. CDN served the new bundle within a minute.
Firebase chunk unmoved (`firebase-Cns3pSRr`). Verified against the live site,
not the local build: slider at 35 with nothing stored, switch unmoved at
x1220/y24, packs 177/76/52, pack still sealed, and two real clips cut on time —
11.9→11.91s and 24.4→24.6s, worst tick 0.269s.

**[#39](https://github.com/gregjrothwell/quiz/pull/39) is open and master has
not moved** — `gh pr merge` was refused by the harness, so the merge is Greg's.
Deployed from the branch, same as 9 September.

**`check-rules` fails two allow cases and they are not this branch's.**
`firestore.rules:323` has `wager` and `firstMs` in the answers `hasOnly`; the
live ruleset does not, so a staked answer and a changed-mind answer are both
refused. The denies pass, which — same as 2 September — is what tells you the
rule is absent rather than wrong. Needs a console paste.

**A slug was serving the wrong answer.** `stableId` is `sha1('hand:' + slug)`,
and `am` was the Arctic Monkeys album in `sleeves` and Armenia in `flags`. Live
vault held "AM", so the Armenia question had marked the room wrong since
9 September. Three more (`thriller`, `back-in-black`, `born-to-run`) came from
today's expansion, benign only because album and song share a title. Fixed with
the `-album` convention `sleeves` already used; a test now refuses a repeated
slug across any hand pack.

## 2026-09-10 — Name that Tune worked; volume, giveaways, 177 songs (branch `music-volume-and-clips`)

First music round that played. Three notes. **Volume**: the loud thing was the
`<audio>` element at 1.0, never the synth cues — no CORS on Apple's CDN so the
master gain never reached it. Default 0.35, slider under the corner switch,
cues unchanged at the default and capped there. **Giveaways**: Apple picks the
preview to be the most recognisable stretch, which for pop is the chorus, which
is where the title is sung — `previewSeconds` cuts the clip before it.
**Songs**: 79 → 177, weighted to `hard` (68/62/47). `resolveSong` now prefers a
title match, not just an artist. `npm run tune-audit` measured all 177 —
**103 clean, 33 trimmed, 31 shifted, 10 unavoidable**. Two checker failures
found and fixed on the way: Parklife called clean because whisper split the
title into "pork life", and seventeen clips that transcribed to nothing where
eleven were only *suppressed* — Shake It Off sings its title six times in ten
seconds and was counted clean. `small.en` heard "Sweet Caroline, good times" as
"The sweet, terrible life", which is why the audit runs `medium.en`.
`melody-round.md` split at 323/250 →
[`tunes-round.md`](decisions/tunes-round.md), verbatim. **Not seeded** (98 new
ids), not deployed.

## 2026-09-09 — Live: On the box (`index-CFub7zgz`)

#36 then #37 merged. `seed-vault` once: **78 added, 0 changed**, 13,781 already
correct (54 screens + 24 other new ids). `npm run deploy`; gh-pages `e2d3bf1`.
Firebase chunk unmoved (`firebase-Cns3pSRr`). Name that Tune not expanded.

## 2026-09-09 — On the box pack written locally
Recut off Fine Art’s PD-Art era bias. Mixed 1990s–2020s, not a 1960s–80s wall. Seal 16. Not seeded, not live. `seed-vault` needs Greg.

## 2026-09-09 — On the box parked (superseded same day)

Writer was waiting on the key. Pack was then written (54) — see above. Not seeded, not live. Pickup: [`questions.md`](decisions/questions.md#picking-up-on-the-box).

## 2026-09-09 — On the box via TMDB untitled backdrops (branch `on-the-box-tmdb`)

iTunes movie Search is empty in US as well as GB; Lookup only covers leftover
rentals. TMDB backdrops with `iso_639_1 === null` are the title-free stills.
Hashed onto Pages like flags. Needs `TMDB_API_KEY`, then seed. Not live.

## 2026-09-09 — Live: iTunes Name that Tune, flags, sleeves (`index-6odlsKCm`)

Pushed `itunes-tunes-and-flags` (`10260ce`), then `npm run deploy`. gh-pages
`6dd46ce`. CDN served `index-Df9CfP0K` for about a minute, then
`index-6odlsKCm`. Firebase chunk unmoved (`firebase-Cns3pSRr`). Packs 200:
tunes, flags, sleeves on `index.json`. Vault already held the new ids (206
added, 0 changed). **master still at `e19d518` until the PR merges.** Unplayed.

## 2026-09-09 — Vault topped up for tunes, flags, sleeves

`seed-vault` against `quiz-d686e`, service account, one run: **206 added, 0
changed**, 13,575 already correct. Was 13,712. The packs themselves are still
on `itunes-tunes-and-flags`, not deployed.

## 2026-09-09 — iTunes Name that Tune, flags, sleeves (branch `itunes-tunes-and-flags`)

Not live. Not seeded. 15 sealed packs. `tunes` stole the lobby name (79 GB
previews, streamed, badge, slug stripped). Synth pack is **Classical**. **Flags**
76 including home nations, hashed, no jigsaw. **Sleeves** 52, mzstatic hotlink,
never hosted. Picture retitled **Fine Art**. **On the box** writer exists; GB
Search returns 0 movies so it does not ship. [`round-types.md`](decisions/round-types.md),
[`melody-round.md`](decisions/melody-round.md).

## 2026-09-08 — The whole day, archived

`firstMs` shipped — the snap guess *shown* at the reveal, not banned (Greg chose
exposure over restriction on cost) — and the A–D spam lottery that exposed;
`games/{gameId}` built so a finished round survives its answers subcollection,
and the A/B gap that forced it (test per-question things, never per-round); the
melody round given **Hear it again**; and all of it live as `index-BDZpMBAG`,
`check-rules` 65/65. Plus the two moved earlier — the melody round abandoned
after four, the five-column picker. Moved whole on 10 September at 299/300:
[`recall/2026-09.md`](recall/2026-09.md).

## 2026-09-04 — Three more entries archived

"The rest of the file is stale" is not evidence about a line; melody and picture
going live with the vault as the gate; and the `melody-round` branch itself.
Moved whole on 10 September at 322/300: [`recall/2026-09.md`](recall/2026-09.md).

## 2026-09-04 — Three entries archived

The squad-write correction, the negatives paste (`check-rules` allow **PASS**
after the paste, which is what made the two deny cases mean anything), and the
lobby writing the squad plus a stake that can go below zero. Moved whole on
10 September at 313/300: [`recall/2026-09.md`](recall/2026-09.md).

## Earlier — the full chronology, archived

Forty-two entries, moved on 28 August, 2 September, 8 September 2026 (twice) and
9 September, unchanged. Newest first, as above.

- **2026-09-04** — [The hand-built answers are in the public repo](recall/2026-09.md#2026-09-04--the-hand-built-answers-are-in-the-public-repo)
- **2026-09-04** — [Live, and the CDN lied for a minute](recall/2026-09.md#2026-09-04--live-and-the-cdn-lied-for-a-minute)
- **2026-09-04** — [The mute button, and a squad nobody could pick](recall/2026-09.md#2026-09-04--the-mute-button-and-a-squad-nobody-could-pick)
- **2026-09-04** — [The first right answer steals from the leader](recall/2026-09.md#2026-09-04--the-first-right-answer-steals-from-the-leader)
- **2026-09-04** — [The chair seats everybody, and the prose was wrong](recall/2026-09.md#2026-09-04--the-chair-seats-everybody-and-the-prose-was-wrong)
- **2026-09-02** — [Both went live the same afternoon](recall/2026-09.md#2026-09-02--both-went-live-the-same-afternoon)
- **2026-09-02** — [The repeats, and a wager that had never existed](recall/2026-09.md#2026-09-02--the-repeats-and-a-wager-that-had-never-existed)
- **2026-08-29** — [A design review lands, and four of its six get built](recall/2026-08.md#2026-08-29--a-design-review-lands-and-four-of-its-six-get-built)
- **2026-08-28** — [The rig gets operated](recall/2026-08.md#2026-08-28--the-rig-gets-operated)
- **2026-08-28** — [A UI audit, and the verdict pills get a thumb](recall/2026-08.md#2026-08-28--a-ui-audit-and-the-verdict-pills-get-a-thumb)
- **2026-08-28** — [A dependency pass, and four majors held back](recall/2026-08.md#2026-08-28--a-dependency-pass-and-four-majors-held-back)
- **2026-08-28** — [Squads score during the round](recall/2026-08.md#2026-08-28--squads-score-during-the-round)
- **2026-08-28** — [A reload keeps your seat](recall/2026-08.md#2026-08-28--a-reload-keeps-your-seat)
- **2026-08-28** — [The ideas list re-sorted around what shipped](recall/2026-08.md#2026-08-28--the-ideas-list-re-sorted-around-what-shipped)
- **2026-08-28** — [Voting and auto-join are live, and proved on the deployed site](recall/2026-08.md#2026-08-28--voting-and-auto-join-are-live-and-proved-on-the-deployed-site)
- **2026-08-28** — [The office can vote a question out](recall/2026-08.md#2026-08-28--the-office-can-vote-a-question-out)
- **2026-08-28** — [The join link goes straight into the room](recall/2026-08.md#2026-08-28--the-join-link-goes-straight-into-the-room)
- **2026-08-28** — [The shared clock is live, and has been played](recall/2026-08.md#2026-08-28--the-shared-clock-is-live-and-has-been-played)
- **2026-08-20** — [host-room reads the answers, and scores them](recall/2026-08.md#2026-08-20--host-room-reads-the-answers-and-scores-them)
- **2026-08-20** — [The shared clock, and a harness that scores nothing](recall/2026-08.md#2026-08-20--the-shared-clock-and-a-harness-that-scores-nothing)
- **2026-08-20** — ["The Ladder" was already taken](recall/2026-08.md#2026-08-20--the-ladder-was-already-taken)
- **2026-08-20** — [The final screen makes a shareable card](recall/2026-08.md#2026-08-20--the-final-screen-makes-a-shareable-card)
- **2026-08-20** — [Scoring is a rank bonus, not a speed curve](recall/2026-08.md#2026-08-20--scoring-is-a-rank-bonus-not-a-speed-curve)
- **2026-08-20** — [Three directional decisions, and an ideas review](recall/2026-08.md#2026-08-20--three-directional-decisions-and-an-ideas-review)
- **2026-08-20** — [App Check on auth is enforcing after all, hours late](recall/2026-08.md#2026-08-20--app-check-on-auth-is-enforcing-after-all-hours-late)
- **2026-08-20** — [check-rules was not leaking; the three rows were older than the fix](recall/2026-08.md#2026-08-20--check-rules-was-not-leaking-the-three-rows-were-older-than-the-fix)
- **2026-08-20** — [take-stock had been under-reporting since weekly boards shipped](recall/2026-08.md#2026-08-20--take-stock-had-been-under-reporting-since-weekly-boards-shipped)
- **2026-08-20** — [The squad dropdowns were never styled](recall/2026-08.md#2026-08-20--the-squad-dropdowns-were-never-styled)
- **2026-08-20** — [The reveal was a coin flip, and the host's device always called it](recall/2026-08.md#2026-08-20--the-reveal-was-a-coin-flip-and-the-hosts-device-always-called-it)
- **2026-08-20** — [Anonymous account purge: reviewed, and the answer is don't](recall/2026-08.md#2026-08-20--anonymous-account-purge-reviewed-and-the-answer-is-dont)
- **2026-08-20** — [App Check enforced on the Realtime Database](recall/2026-08.md#2026-08-20--app-check-enforced-on-the-realtime-database)
- **2026-08-20** — [Build-time code moved out of `src/`, and two routes stopped shipping](recall/2026-08.md#2026-08-20--build-time-code-moved-out-of-src-and-two-routes-stopped-shipping)
- **2026-08-20** — [The pack seal was a convention, not a test](recall/2026-08.md#2026-08-20--the-pack-seal-was-a-convention-not-a-test)
- **2026-08-20** — [The handover was split, because it cost more than the code](recall/2026-08.md#2026-08-20--the-handover-was-split-because-it-cost-more-than-the-code)
- **2026-08-20** — [Correction: the room count, settled by measuring](recall/2026-08.md#2026-08-20--correction-the-room-count-settled-by-measuring)
- **2026-08-20** — [`host-room` had been dead for weeks](recall/2026-08.md#2026-08-20--host-room-had-been-dead-for-weeks)
- **2026-08-20** — [Squads, weekly boards and the average table went live](recall/2026-08.md#2026-08-20--squads-weekly-boards-and-the-average-table-went-live)
- **2026-08-19** — [`recordGame` proved against the live project](recall/2026-08.md#2026-08-19--recordgame-proved-against-the-live-project)
- **2026-08-17** — [A `joinedAt` from one room walked into another](recall/2026-08.md#2026-08-17--a-joinedat-from-one-room-walked-into-another)
- **2026-08-16** — [App Check enforcing on Cloud Firestore](recall/2026-08.md#2026-08-16--app-check-enforcing-on-cloud-firestore)
- **2026-08-15** — [Six wrong statements about Google's console in one afternoon](recall/2026-08.md#2026-08-15--six-wrong-statements-about-googles-console-in-one-afternoon)
- **2026-08-15** — [Rooms pruned, and TTL turned out to need billing](recall/2026-08.md#2026-08-15--rooms-pruned-and-ttl-turned-out-to-need-billing)
- **2026-08-15** — [Teams, then squads](recall/2026-08.md#2026-08-15--teams-then-squads)
- **2026-08-15** — [The security review](recall/2026-08.md#2026-08-15--the-security-review)
- **2026-08-14** — [The clock, heard rather than reasoned about](recall/2026-08.md#2026-08-14--the-clock-heard-rather-than-reasoned-about)
- **2026-08-13** — [A refused reveal stalled the round for minutes](recall/2026-08.md#2026-08-13--a-refused-reveal-stalled-the-round-for-minutes)
- **2026-08-13** — [The vault is ahead of the packs, not behind](recall/2026-08.md#2026-08-13--the-vault-is-ahead-of-the-packs-not-behind)
- **2026-08-03** — [`season-2` started with the office](recall/2026-08.md#2026-08-03--season-2-started-with-the-office)
