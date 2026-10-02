# TOTAL-RECALL

> **Owner: Greg Rothwell. Last updated: 2 October 2026. Budget: 300 lines.**

The dated spine. Newest first, a few lines per entry. When one needs more room
than that it moves to `decisions/<topic>.md` and the entry here keeps a pointer —
depth goes outward, chronology stays central.

Append; do not rewrite an earlier entry to make it look as if we always knew. A
correction is a new dated note that says what changed, and the wrong claim stays
visible.

**Split eight times, 28 August to 29 September 2026** — every time this file hit
300. Entries move *verbatim* to [`recall/2026-08.md`](recall/2026-08.md) or
[`recall/2026-09.md`](recall/2026-09.md) and leave a dated pointer here, so the
chronology still reads end to end. Shortening an old entry to make the number go
down is the thing the paragraph above forbids.

Two lessons the next split will meet again. **A split's numbers go stale if it
sits unmerged** — the 4 September one was cut at 350, landed on the 8th at 360,
and described the wrong file until re-checked. And **an entry moved a directory
down breaks every relative link in it**: fourteen were, repaired 21 September.

*Six paragraphs of split history condensed to this on 21 September — process
notes, not chronology; every entry they described is still listed below by date.*

## 2026-10-02 — Public scale: target B chosen; PLAN written, not confirmed

The lost 15 Aug appendix recovered; seams now (host authority, tenancy, content rule), the rest on a trigger. [`decisions/public-scale.md`](decisions/public-scale.md).

## 2026-10-02 — Catchphrase's first round: 10 of 10, too easy

Greg alone, `H4DS`, 10 s clock: every answer 0.8–3.1 s after the options
landed, "hard" no slower than "easy". Solved from the picture; the hold works,
the puzzles are easy. One player, and 17 of the 30 were in a list he skimmed.
Levers: [`decisions/catchphrase-difficulty.md`](decisions/catchphrase-difficulty.md).

## 2026-10-02 — Live: `index-DPum3N0P` (#64, gh-pages `7a8dc6f`)

Greg said merge and deploy. [#64](https://github.com/gregjrothwell/quiz/pull/64)
merged `6d1e3a7` 15:57:05Z, PR e2e still running; master verify, e2e, publish
green; gh-pages `7a8dc6f` (Actions) 16:00:08, Pages `built` 46s. **Live bundle
byte-identical to a local build** (`94ef589f8400`). 17 packs. **Unplayed.**

## 2026-10-02 — Catchphrase: options at halfway, and Greg plays it blind

Greg chose the 1980s look and, worried four options make the answer obvious,
the picture alone for half the clock (`src/engine/optionsHold.ts`, client only,
no paste). He plays the round, so Claude checks the drawings, twelve named
phrases were swapped out, and no doc names an answer.

## 2026-10-02 — Catchphrase: the pictures come from a free model on Greg's Mac

Greg turned down emoji-and-words and a paid image API. Z-Image-Turbo through
`mflux` (Apache 2.0, not gated, 32.9 GB) drew 5 phrases three times each: 14 of
15 readable after one prompt rewrite, lettering only where asked, no prompt in
the files. **Quantising at load swapped a 24 GB Mac to 70 s a step; a saved
8-bit copy runs at 11–13 s.** Nothing built; story and 30 phrases await Greg.
[`decisions/catchphrase.md`](decisions/catchphrase.md).

## 2026-09-30 — Live: `index-frzpKPeW` (#63, gh-pages `9cf24c8`)

Sleeve song from the first frame, Name that Tune locked to 10s, and the lobby
sound check. Before merge: 1,170 unit tests, `check-rules` 91/0,
`sync-harness 10` 10/10, `rank-harness` and `final-harness` green, and live room
`Y4XR` played a sleeve's song on the question's first frame. `e2e` could not run
locally (no Java); CI's Playwright job passed. Auto-merge was refused by Claude
Code's permission classifier, so Greg merged. Pages `built` in 61s; the live
bundle carries the new copy. **Unplayed in production.**

## 2026-09-30 — Joe's missing points were not missing; the music rounds start at once

Joe said he was short after `XDUF` (Sleeves) and `SQ8V` (Tunes). **Every delta
in both rounds recomputes exactly** from the answers with `tallyQuestion`, every
stored score equals its summed deltas, each `correctIndex` names the same text as
the local vault, and his season row banked 6,000 and 19,200. He answered all 35
questions, so none was lost to a late reveal. What did cost him: **nine changes
of pick**, three first touched at 0.5–0.6s. Rank is timed on the *last* change
(`first-touch.md` AC 6) — at most 1,100 points across both rounds. Also: **two
season rows** under "Joe" (27,500 on a uid last used 17 Sep). Method:
[`game-record.md`](decisions/game-record.md#a-player-says-they-were-short).

Built on `music-rounds-start-at-once`, **not merged**: a sleeve's song plays from
the first frame (`SONG_CLUE_SHARE` 0 — in `XDUF` 133 of 175 answers beat a
half-clock song), and Name that Tune is always ten seconds (Greg: on fifteen the
clips sang their titles). **Open, Greg's call:** an audio check before the first
question, and whether answering should wait until the music stops.
[`sleeves-song.md`](decisions/sleeves-song.md) · [`tunes-round.md`](decisions/tunes-round.md).

**Later the same day:** Greg chose the lobby sound check (option A, no rules
paste) over a synced check in place of question one. Built on the same branch:
ten seconds of a preview through `playPreview`, with the volume slider beside
it. Checked in the built bundle, live volume change mid-clip included.
Answering after the music stops is still open, recommended against.
[`sound-check.md`](decisions/sound-check.md).

## 2026-09-29 — Live: `index-BJxsEAQd` (#62, gh-pages `f5a273b`)

A Sleeves cover now plays alone for half the clock, then a song from the same
album starts: "which album is this song on?", with four same-artist options.
There are songs on 102 of 104 sleeves, hand-picked, and any song whose title
names the album or shares a distinctive word with it is refused. Ids are
unchanged, so there was no reseed. No rules change. `host-room -- 10 --pack sleeves`,
two tabs: `play()` at 5,002/5,003ms, on the element primed at the open. The first
run caught the clock bed dropping that element. CI and Pages are green, and the
Firebase chunk is unchanged. **Unplayed in production**: Claude's browser is App
Check-throttled. Depth: [`decisions/sleeves-song.md`](decisions/sleeves-song.md).

## 2026-09-27 — Live: `index-BJIHPrGR` (#61, gh-pages `6b06c51`)

On the box 296, Sleeves 104, Name that Tune 268, and a spent pack repeats its
oldest questions first. Grown because the office plays those three (8 of the
last 10 rounds); **Fine Art was grown and reverted** — unplayed, so not worth
anybody's review. Vault seeded before the merge: 270 added, read back 680/680,
every answer one of its options. `check-rules` 91/91. CI verify + Playwright
pass; Pages built 43s after publish; bundle, five pack files and 296 stills
**byte-identical** to a local build of `16c4539`; 104 sleeve covers load.
Live round `9PQX` in the built-in browser: new and old tunes revealed from the
vault, an answer written in 1.4s and marked wrong correctly; left unfinished,
not banked. **First load got an App Check 403, and the SDK then throttled that
browser for 24 hours** — a likely shape for Cass's undiagnosed failed join.
Depth: [`decisions/cost.md`](decisions/cost.md), [`decisions/repeats.md`](decisions/repeats.md),
[`decisions/sleeves-gate.md`](decisions/sleeves-gate.md), [`decisions/tunes-title-gate.md`](decisions/tunes-title-gate.md).

## 2026-09-24 — Live: `index-fy6Fyqpa` (#60, gh-pages `5bf6290`)

Share or Shaft and On the box 187. Seed 129 added / 0 changed, vault read-back 187/187,
`check-rules` 91/91, CI verify + Playwright pass; Pages built in 40s, bundle byte-identical
to a local build, all 187 stills served. `YHK3` on the live site against a local client:
10 new On the box questions revealed, final settled shaft/share 7,000/0, not banked.

## 2026-09-24 — On the box: 54 to 187, stacked on Share or Shaft

The 54 were played out in four rounds and ran 37 easy to 1 hard; 133 added,
leaning medium and hard. Contact-sheeted: two printed their own answer (Bridget
Jones's "DIARY", the Jumanji box) and were dropped — the pack has no refusal list.
`more-picture-questions` stacks on `share-or-shaft`, so one merge ships both.
**Unseeded.** [`decisions/questions.md`](decisions/questions.md#on-the-box-second-harvest).

## 2026-09-24 — Split or Steal: a final after the last question, not a mode

Greg's calls: an option like the wager, not a mode; the top two play for both
their scores; it banks to the season; the leader picks instead if it goes stale.
Story and acceptance criteria, nothing built:
[`decisions/share-or-shaft.md`](decisions/share-or-shaft.md). Later the same day:
named **Share or Shaft**, picks sealed by commit-then-reveal, and built on
`share-or-shaft` — **rules not pasted**. Two holes found while building (a
`gameId` hop, and reveals that stranded a finalist) and closed; both in the doc.
**Pasted the same afternoon:** `check-rules` 86/5 → **91/91**, `final-harness`
`S3DW` paid 1,900/0/0 with three re-commits refused, `sync-harness` 10/10, and a
two-browser round, `QUF7`, played through the final to the reveal. Not deployed.

## 2026-09-22 — Live: `index-BE_5Hyg5` (#59, gh-pages `7b72a40`)

[#59](https://github.com/gregjrothwell/quiz/pull/59) merged as `cd4a1be` at
09:16; CI published gh-pages `7b72a40` at 09:19:56, author **GitHub Actions**.
Pages `built` 09:21:09 (72s). **The live bundle's sha matches a local build of
that tree byte for byte** — `index-BE_5Hyg5.js`, `14b8f2e0`, both sides.
Firebase chunk unmoved at `firebase-W6iQUl4r`. CI ran **Playwright against the
emulators — pass**, which is the check that cannot run on this Mac at all: no
Java runtime, so `npm run e2e` never starts the emulators. Before the merge:
`check-rules` 81/81, `rank-harness` `MB7R` to `finished`, `sync-harness 10` at
10/10, `check-bundle` clean, 1,028 tests. Live site checked after the build —
no store badge on any question, the iTunes attribution on the tune card, none
on the sleeve. Unplayed.

## 2026-09-22 — The store badge was handing out the answer, on both packs

*Which album is this?* sat above a live **View in Apple Music** link for the
whole answering window, on all 44 sleeves; **Listen on Apple Music** did the
same on all 177 tunes. The slug was already stripped, so the URL could not name
the work — the destination still did, one tap away. Both now wait for the
reveal.

The repo had been calling the badge "the only clean hook" for Apple's terms.
Read against the actual text, it is one of six conditions and never the
load-bearing one: **(i) promoting the item and (v) no independent entertainment
value are the two a quiz cannot meet**, badge or no badge, and (iii)'s "courtesy
of iTunes" attribution has never been there at all. Greg took the call knowing
that. Source, date fetched and the decision:
[`decisions/known-limits.md`](decisions/known-limits.md). `tunes-round.md` hit
250/250, so the title audit split verbatim to
[`decisions/tunes-title-gate.md`](decisions/tunes-title-gate.md).

## 2026-09-22 — The pin refused the reveal: every round stuck on question one

Archived whole: [`recall/2026-09.md`](recall/2026-09.md). Depth:
[`decisions/postmortem-the-pin-that-refused-the-reveal.md`](decisions/postmortem-the-pin-that-refused-the-reveal.md).

## 2026-09-21 — Live: `index-OfECpKrx` (#56, gh-pages `f78379e`)

[#56](https://github.com/gregjrothwell/quiz/pull/56) at 16:47; gh-pages `f78379e`
at 16:50:43. Archived whole: [`recall/2026-09.md`](recall/2026-09.md).

## 2026-09-21 — Vault oracle, joinedAt, and the `at` stamp

Archived whole: [`recall/2026-09.md`](recall/2026-09.md). Depth:
[`decisions/security-round-sept-2026.md`](decisions/security-round-sept-2026.md).

## 2026-09-21 — Live: `index-BHcNzJzP` (#54, gh-pages `026d7cd`)

[#54](https://github.com/gregjrothwell/quiz/pull/54) at 15:11; gh-pages `026d7cd`
at 15:15:29. Pages lagged four minutes. Unplayed. Archived whole:
[`recall/2026-09.md`](recall/2026-09.md).

## 2026-09-21 — Correction: the sleeve audit missed a third of them, and a person found the rest

Archived whole: [`recall/2026-09.md`](recall/2026-09.md).

## 2026-09-21 — The picture sits beside the answers now

Archived whole: [`recall/2026-09.md`](recall/2026-09.md).

## 2026-09-21 — Sleeves: the cover was the answer key on 11 of 15

Archived whole: [`recall/2026-09.md`](recall/2026-09.md). Depth:
[`decisions/sleeves-gate.md`](decisions/sleeves-gate.md).

## 2026-09-21 — The pictures did not turn up, and it was never the files

Archived whole: [`recall/2026-09.md`](recall/2026-09.md). Depth:
[`decisions/picture-loading.md`](decisions/picture-loading.md).

## 2026-09-04 to 2026-09-11 — archived, one line each

*Collapsed from four-line stubs on 30 September 2026 to make room; every
entry is verbatim in the archive, and nothing was shortened.*

- **2026-09-11** — [#52 live: `index-n26s0ofl`](recall/2026-09.md#2026-09-11--52-live-index-n26s0ofl)
- **2026-09-11** — [The round was the best yet, and three things came out of it](recall/2026-09.md#2026-09-11--the-round-was-the-best-yet-and-three-things-came-out-of-it)
- **2026-09-10** — [Playwright prerequisites: jsdom, emulators, e2e job](recall/2026-09.md#2026-09-10--playwright-prerequisites-jsdom-emulators-e2e-job)
- **2026-09-10** — [Node 20 deprecation: the four actions clear it at three different majors](recall/2026-09.md#2026-09-10--node-20-deprecation-the-four-actions-clear-it-at-three-different-majors)
- **2026-09-10** — [Season form seeded on old rows, and they are estimates](recall/2026-09.md#2026-09-10--season-form-seeded-on-old-rows-and-they-are-estimates)
- **2026-09-10** — [Deploys come from CI now (`index-qJCbuGrA`)](recall/2026-09.md#2026-09-10--deploys-come-from-ci-now-index-qjcbugra)
- **2026-09-10** — [Three corrections the live project made to the docs](recall/2026-09.md#2026-09-10--three-corrections-the-live-project-made-to-the-docs)
- **2026-09-10** — [The season form ranking was live, then silently reverted](recall/2026-09.md#2026-09-10--the-season-form-ranking-was-live-then-silently-reverted)
- **2026-09-10** — [Deploy guard added; CI outlined for later](recall/2026-09.md#2026-09-10--deploy-guard-added-ci-outlined-for-later)
- **2026-09-10** — [Token revoked and reissued; leak closed](recall/2026-09.md#2026-09-10--token-revoked-and-reissued-leak-closed)
- **2026-09-10** — [Live: the debug-token gate (`index-V9wVdhyu`), and #40 for the rules](recall/2026-09.md#2026-09-10--live-the-debug-token-gate-index-v9wvdhyu-and-40-for-the-rules)
- **2026-09-10** — [Correction: the console was ahead of the repo, not behind](recall/2026-09.md#2026-09-10--correction-the-console-was-ahead-of-the-repo-not-behind)
- **2026-09-10** — [Live: volume, clip cuts, 177 songs (`index-C3jZR3XU`)](recall/2026-09.md#2026-09-10--live-volume-clip-cuts-177-songs-index-c3jzr3xu)
- **2026-09-10** — Name that Tune worked; volume, giveaways, 177 songs — [`recall/2026-09.md`](recall/2026-09.md) · depth: [`decisions/tunes-round.md`](decisions/tunes-round.md)
- **2026-09-09** — The whole day, archived — [`recall/2026-09.md`](recall/2026-09.md)
- **2026-09-08** — The whole day, archived — [`recall/2026-09.md`](recall/2026-09.md)
- **2026-09-04** — Three more entries archived — [`recall/2026-09.md`](recall/2026-09.md)
- **2026-09-04** — Three entries archived — [`recall/2026-09.md`](recall/2026-09.md)

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
