# TOTAL-RECALL

> **Owner: Greg Rothwell. Last updated: 24 September 2026. Budget: 300 lines.**

The dated spine. Newest first, a few lines per entry. When one needs more room
than that it moves to `decisions/<topic>.md` and the entry here keeps a pointer —
depth goes outward, chronology stays central.

Append; do not rewrite an earlier entry to make it look as if we always knew. A
correction is a new dated note that says what changed, and the wrong claim stays
visible.

**Split seven times, 28 August to 24 September 2026** — every time this file hit
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

Greg played a picture round and it would not leave the first question. Not
picture-specific — **every pack, every round**. Yesterday's `questionsPinned`
believed `selectPack` and `reset` were the only writers of `questions`.
`reveal` is a third: it stamps the answer into `questions[index].correctIndex`
so the others read it off the room update rather than each paying a vault round
trip (`reducer.ts` 339). Pinned byte for byte, that write is refused.

**Every deny case passed the afternoon the pin shipped, because a rule that
refuses everything refuses those too.** The allow direction was never asked —
exactly the failure `EVIDENCE.md` describes, in the same file that describes it.
The allow case FAILed against the published ruleset, then PASSed after the
paste, deny cases holding — `check-rules` **81/81**. `rank-harness` then played
room `CNSE` start→`finished` live: 1000/900/800/700/700/600 and a zero, read
back from the server. Rules only, no redeploy. Depth: [`decisions/security-round-sept-2026.md`](decisions/security-round-sept-2026.md).

## 2026-09-21 — Live: `index-OfECpKrx` (#56, gh-pages `f78379e`)

Greg said go live. [#56](https://github.com/gregjrothwell/quiz/pull/56) merged as
`81d55a4` at 16:47; CI published gh-pages `f78379e` at 16:50:43, author **GitHub
Actions**. Pages `built` 16:51:33 (~48s). **Published bundle matches a local
build of that tree exactly** — `index-OfECpKrx.js`, sha `3272b19a`, both sides.
Firebase chunk unmoved at `firebase-W6iQUl4r`. Merge commit, not squash: this
contained #55, which closed itself as merged. Second RTDB paste landed 16:56:
`{ at }` allowed, `{ name, at }` refused, `check-rules` 80/80. One round, then
`audit-players`.

## 2026-09-21 — Vault oracle, joinedAt, and the `at` stamp

Any signed-in player could extract the vault: rewrite `questions[0].id` without
moving phase or index, then four reveal writes. `check-rules` passed for the
wrong reason. Closed by pinning `questions` to the lobby. `joinedAt: 0` seized
quizmaster; now a new entry is ±5 minutes and an existing one cannot move.
Answers carry optional `at: serverTimestamp()`; rank still reads `elapsedMs`.
Presence drops `name` (two RTDB pastes). Alistair is fastest in 11 of 12 with
a 203 ms right→wrong gap; do not accuse — `npm run audit-players` after one
round is the answer. Depth:
[`decisions/security-round-sept-2026.md`](decisions/security-round-sept-2026.md).

## 2026-09-21 — Live: `index-BHcNzJzP` (#54, gh-pages `026d7cd`)

[#54](https://github.com/gregjrothwell/quiz/pull/54) at 15:11; gh-pages `026d7cd`
at 15:15:29. Pages lagged four minutes. Unplayed. Archived whole:
[`recall/2026-09.md`](recall/2026-09.md).

## 2026-09-21 — Correction: the sleeve audit missed a third of them, and a person found the rest

The entry below says 40 published against a 36 floor. **Both numbers were wrong
by the time the day ended, and the reason is worth more than the numbers.**

Apple's Vision reads printed prose well and stylised cover type not at all. Of
the 37 covers it cleared, **eleven print their own title** — letterspaced (`T H E
J O S H U A  T R E E`), scripted (*The Fame*, on the sunglasses), or upside down
in one tile of a grid (*Achtung Baby*). A second batch of candidates the same
afternoon held the rate almost exactly: eight of 26. **Roughly a third, twice.**

So the audit narrows the field and a person settles it, by looking —
`sleeve-audit -- --sheet` writes a labelled contact sheet and every one of the
nineteen is obvious in it at 190px. The nineteen are in `sleeve-refusals.ts`
with what is on each cover and what Vision read instead, so the judgement
survives a regenerate.

216 candidate albums added in all. **229 resolved, 185 refused, 44 published** —
the 36 floor held without moving. Re-rated against the covers themselves:
3/15/26 easy/medium/hard becomes **12/20/12**. Those ratings are judgements, not
measurements, and stand exactly as the season's seeded `form` figures do.

**Vault seeded and read back: 44 of 44 published sleeves hold a valid answer.**
Nothing was deleted, so the 52-question pack still live keeps working. Also
live-affecting and fixed: a one-character title is now refused outright, because
`words('÷')` is empty and the glyph *is* the artwork.

Depth: [`decisions/sleeves-gate.md`](decisions/sleeves-gate.md).

## 2026-09-21 — The picture sits beside the answers now

Greg: the pictures are a bit small. Measured on a 1512px laptop — a 448px still
capped at 28rem in a 965px card, **517px of the row beside it empty**, and 12px
between the picture and the top lectern. No vertical room to grow into and a
whole column going unused.

Above 64rem a picture question puts the still on the left and the four lecterns
in a single column on the right. Flags 448×224 → **614×307**; On the box
448×252 → **614×345** — 1.88× the area, both. Squares are left alone: a sleeve
at full column width is taller than the lecterns beside it and pushes the row
below the fold. The row height is still set by the lecterns, so nothing moved
further down the page.

**Hover-to-enlarge was asked for and then dropped** — Greg, once the numbers
were on the table: the layout change will probably be enough.

## 2026-09-21 — Sleeves: the cover was the answer key on 11 of 15

Archived whole: [`recall/2026-09.md`](recall/2026-09.md). Depth:
[`decisions/sleeves-gate.md`](decisions/sleeves-gate.md).

## 2026-09-21 — The pictures did not turn up, and it was never the files

Archived whole: [`recall/2026-09.md`](recall/2026-09.md). Depth:
[`decisions/picture-loading.md`](decisions/picture-loading.md).

## 2026-09-11 — #52 live: `index-n26s0ofl`

Archived whole: [`recall/2026-09.md`](recall/2026-09.md).

## 2026-09-11 — The round was the best yet, and three things came out of it

Archived whole: [`recall/2026-09.md`](recall/2026-09.md).

## 2026-09-10 — Playwright prerequisites: jsdom, emulators, e2e job

Archived whole: [`recall/2026-09.md`](recall/2026-09.md).

## 2026-09-10 — Node 20 deprecation: the four actions clear it at three different majors

Archived whole: [`recall/2026-09.md`](recall/2026-09.md).

## 2026-09-10 — Season form seeded on old rows, and they are estimates

Archived whole: [`recall/2026-09.md`](recall/2026-09.md).

## 2026-09-10 — Deploys come from CI now (`index-qJCbuGrA`)

Archived whole: [`recall/2026-09.md`](recall/2026-09.md).

## 2026-09-10 — Three corrections the live project made to the docs

Archived whole: [`recall/2026-09.md`](recall/2026-09.md).

## 2026-09-10 — The season form ranking was live, then silently reverted

Archived whole: [`recall/2026-09.md`](recall/2026-09.md).

## 2026-09-10 — Deploy guard added; CI outlined for later

Archived whole: [`recall/2026-09.md`](recall/2026-09.md).

## 2026-09-10 — Token revoked and reissued; leak closed

Archived whole: [`recall/2026-09.md`](recall/2026-09.md).

## 2026-09-10 — Live: the debug-token gate (`index-V9wVdhyu`), and #40 for the rules

Archived whole: [`recall/2026-09.md`](recall/2026-09.md).

## 2026-09-10 — Correction: the console was ahead of the repo, not behind

Archived whole: [`recall/2026-09.md`](recall/2026-09.md).

## 2026-09-10 — Live: volume, clip cuts, 177 songs (`index-C3jZR3XU`)

Archived whole: [`recall/2026-09.md`](recall/2026-09.md).

## 2026-09-10 — Name that Tune worked; volume, giveaways, 177 songs

Archived whole: [`recall/2026-09.md`](recall/2026-09.md). Depth:
[`decisions/tunes-round.md`](decisions/tunes-round.md).

## 2026-09-09 — The whole day, archived

Archived whole: [`recall/2026-09.md`](recall/2026-09.md).

## 2026-09-08 — The whole day, archived

Archived whole: [`recall/2026-09.md`](recall/2026-09.md).

## 2026-09-04 — Three more entries archived

Archived whole: [`recall/2026-09.md`](recall/2026-09.md).

## 2026-09-04 — Three entries archived

Archived whole: [`recall/2026-09.md`](recall/2026-09.md).

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
