# TOTAL-RECALL

> **Owner: Greg Rothwell. Last updated: 9 September 2026. Budget: 300 lines.**

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

## 2026-09-08 — Live: the round is kept, and the tune can be heard again (`index-BDZpMBAG`)

Greg pasted the `games` block; `check-rules` **65/65**, the allow case flipped.
#31, #32 and #33 merged in that order, each diff checked locally against the
master it was about to land on — GitHub's file list for #32 was stale and named
a file that did not differ. Deployed 19:47; the CDN served `index-B3Tfo0Nu` for
fifty seconds and caught up at 19:48. The bundle carries `Hear it again`,
`games`, `writtenBy`, `finishedAt` and no `MELODY_SPECS`; the Firebase chunk is
unmoved at `firebase-Cns3pSRr`; the packs 200. `sync-harness 10`: **10/10, 0
dropped, all ten inside 71ms**. Nothing kept yet — that needs a round to finish.

## 2026-09-08 — The melody round can be heard again (branch `melody-replay`)

**Hear it again**, under the prompt while the clock runs, `R` on the keyboard;
disabled at the buzzer, gone at the reveal; unmutes a muted player rather than
doing nothing. Shipped to everybody, not A/B'd within the round as the research
suggested — the dead air is a defect and a half-fixed round would look broken to
the room that walked out. Before is `DTK8`; after is what `read-games` says next
time. Read off server-rendered markup in four states; not yet pressed in a
browser. Stacked on `keep-the-round`. [`melody-round.md`](decisions/melody-round.md).

## 2026-09-08 — The round is kept: `games/{gameId}` (branch `keep-the-round`)

**Built, not live — the `games` block needs its paste first.** One document per
finished round, written by the quizmaster's device, global and never read by a
client. It holds every response the answers subcollection destroys: per question
the id, difficulty, kind, correct index, each player's pick, time, `firstMs` and
stake. A round with a skipped question is still kept, marked, because the skip
is the tool most likely to be reached for on a tune nobody knew — gating on
`sawWholeGame` would have lost the melody round this exists to explain.
`check-rules` **64/65** against the live rules: the allow case `keep a finished
round` FAILs with the block unpublished, exactly as it should, and six deny
cases pass vacuously until it is. `npm run read-games` reads it back on the
Admin SDK and ran clean against the live project: *Nothing kept yet.* Drift test
forced red and back. [`game-record.md`](decisions/game-record.md).

## 2026-09-08 — A/B testing is blocked on one gap, and it is not the framework

`rooms/{code}/answers/{uid}` is overwritten every question, so a finished round
holds only the last one — the questions and the right answers both survive, the
responses do not. Fix is one write at the end of a game into a global `games/`
collection, never a room subcollection (a second `Q·N²` term). Also measured: the
wager is a skill test, 0%/25-50%/100% hitting 29/50/62%, so staking blind makes
it a lottery — and at 6.5 stakes a round it would take 37 wager rounds against
five ever played. Test per-question things, never per-round things.
[`what-to-build-next.md`](decisions/what-to-build-next.md).

## 2026-09-08 — Live: `firstMs` and the pack picker (`index-B3Tfo0Nu`)

Rules pasted first, `check-rules` **58/58** with the allow case passing, then
merged and deployed — that order, because `hasOnly` would otherwise refuse every
changed answer in the room. Greg's first paste was truncated at line 562 of 575
and the console said so; the second landed. PR #27 was closed as collateral when
`--delete-branch` removed the base branch a stacked PR pointed at; reopened as
#28. Unplayed with people.

## 2026-09-08 — `firstMs`: show the snap guess rather than ban it

Greg turned down both restriction shapes on cost and chose exposure. The answer
document carries when a pick was first committed; the reveal marks anything
under a second. Nothing is scored, so no honest player can lose to it. The
document alone was not enough — four presses in 200ms do not round-trip, so a
synchronous ref backs it. Rules paste **before** deploy. 675 tests, drift test
forced red and back. [`first-touch.md`](decisions/first-touch.md).

## 2026-09-08 — Spamming A–D at question start is a free lottery ticket

Not fast fingers: a pick can be changed, so a lucky 50ms guess wins the rank
bonus and an unlucky one is revised away at no cost. Measured against `3QDV`'s
own 379 points per chance, that is +41% today and −34% if a pick were final.
Proposed: one pick per question. Awaiting Greg —
[`answer-spam.md`](decisions/answer-spam.md).

## 2026-09-08 — The melody round was played, and abandoned after four

Eight players, fifteen questions set, stopped at four, then they went and played
Science instead and finished it. 8,800 points across 32 chances is 9–15 correct
against 25% for guessing. Median clip 3.45s (20 of 70 under three), played once,
with `stopClock()` killing the bed underneath it. Logged, not fixed —
[`melody-round.md`](decisions/melody-round.md).

## 2026-09-08 — Pack picker: five columns, twelve packs, 5 + 5 + 2

`auto-fill minmax(13rem)` resolved to five columns in `.stage__inner`, stranding
`Name that Tune` and `Picture Round` bottom-left; and nothing pinned
`.pack__count`, so it sat at 86/96/117px down neighbouring tiles. Fixed bases of
1/2/3/4 divide twelve exactly at every width, `margin-top: auto` for the count.
Measured at six widths, both before and after.

## 2026-09-04 — "The rest of the file is stale" is not evidence about a line

`ideas-review.md` still said **nobody has seen the rank bonus award an order**. It was corrected
on 30 August on `cursor/fastest-finger`, which never got a PR, so the wrong claim stood here for
five days — and was then nearly lost a second time when that branch's docs were judged superseded
*wholesale* and only its script salvaged. Four of its five doc changes really were superseded;
this one was not. Judge a file, not a branch.

## 2026-09-04 — Melody and picture are live, and the vault was the gate

master `0bf1c5f`, gh-pages `584e80e`, bundle `index-CIOq186A`. #22, #23 and #24
merged in that order. `seed-vault`: **119 added, 0 changed**, 13,456 already
correct — the vault now holds 13,712.

**The order was not cosmetic.** Both packs are in `index.json` and the lobby
offers them, and `resolveAnswer` *throws* when the vault has no doc for a
question rather than scoring zero. Deploying before the seed would have shipped
two pickable packs that break at the reveal.

**Proved on the live site, not assumed.** Room `NDH7`, picture round: The Starry
Night rendered, the clock ran, and the reveal put `tile--correct` on D with the
other three `tile--gone` — read off the DOM classes rather than computed style,
which has lied here before. No console errors.

**The CDN was stale again**, exactly as this morning: gh-pages held
`index-CIOq186A` and served it 200, while live `index.html` still named
`index-BOq4sYDx`. Caught up on re-fetching. Watch it every time.

**A prediction that was wrong, recorded because it changed the instruction:**
the Firebase chunk was called as moving to `Byj7wx-B`. It did not — the real
deploy kept `firebase-Cns3pSRr`. That hash came from a scratch worktree with a
symlinked `node_modules`, which moved every chunk hash. A build outside the
project tree is not the build that ships.

**Three green mergeable badges hid a conflict.** GitHub checks a PR against
master as it stands, not as it will be. #24 read CLEAN and conflicted on
`scoring.md` once #22 and #23 landed. Simulating the stacked merge in a worktree
is what caught it. #23 also did not auto-retarget when #22 merged — GitHub only
does that when the base branch is deleted.

## 2026-09-04 — The hand-built answers are in the public repo

The vault does not cover melody or picture: their specs are committed, the id is
`sha1('hand:' + slug)[:12]`, and the slug sits by `correct:`. Verified —
`sha1('hand:hay-wain')[:12]` = `e26ff5781961`. Not in the bundle, not in
`public/packs/`. Accepted, not fixed: hiding the specs makes the packs
unregenerable. [`known-limits.md`](decisions/known-limits.md).

## 2026-09-04 — Melody, picture, jigsaw (`melody-round`, not live)

70 tunes + 49 stills (jigsaw 3×3 lobby flag). Sealed packs; answers in gitignored
`.cache/hand-vault.json`. Seed the vault before they score. Lobby blocks Start
while muted. "Died before 1956" is right today (CDPA s.12; T−71). Pack newest
composed deaths: Elgar/Holst 1934; Prokofiev 1953 is in. Charleston / Parker
unencoded. [`round-types.md`](decisions/round-types.md).

## 2026-09-04 — Correction: squad-write was committed

`7c27b62` on `squad-write-and-min-stake`. Unpushed. The squad-write entry below said uncommitted.

## 2026-09-04 — The negatives paste landed

`check-rules`: `write a season row that went below zero` **PASS** (allow),
and `write a season row below -maxPoints()` **PASS** (deny). Outstanding #4
had been claiming the live rules still refused a negative. They do not.

## 2026-09-04 — The lobby writes the side, and a stake can go below zero

Branch `squad-write-and-min-stake`, uncommitted.

**The live squad hole.** Auto-join seats a link-joiner before they pick a side,
and `planJoin` leaves an existing entry untouched so a reconnect cannot move
the quizmaster. The lobby picker only wrote storage, and only the quizmaster
could see it. `planSeatSquad` writes `players.{uid}.squad` onto the existing
seat, lobby only; `joinedAt` is not in the plan. The picker is in front of
everybody now.

**A positive stake floors at 500.** A 0% pick is still nothing. A player on
zero who goes in on the last question can finish at −500, and `bankGame`
already had no clamp. Repo `firestore.rules`: `points >= -maxPoints()`,
`best <= points` gone. **Paste before deploy.** `check-rules` gained the allow
case (FAIL until the paste) and the `−maxPoints()` deny.

`playSequence` is exported for a melody round. No tunes, no pictures, no
force-unmute in the lobby — those wait on content.

## Earlier — the full chronology, archived

Forty-one entries, moved on 28 August, 2 September and 8 September 2026 (twice),
unchanged. Newest first, as above.

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
