# TOTAL-RECALL

> **Owner: Greg Rothwell. Last updated: 21 September 2026. Budget: 300 lines.**

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

**Split again, 21 September 2026**, twice in a day. The six remaining
10 September entries went to [`recall/2026-09.md`](recall/2026-09.md) to make
room for that morning's two, and both 11 September entries followed them that
afternoon when a correction and a layout entry needed the space. All whole.

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

`53FN` this morning, 4 seats, hit 85% at a 3.0s median against 37%/5.3s for a
text round. **Eleven of the fifteen covers had the album title printed on them.**
The tell is the hard questions: the four with a printed title all scored **100%**
and the one with a wordless cover — Björk, *Vespertine* — scored **50%**. The
difficulty rating was decorative.

An edition problem more than a curation one: the specs name an album, iTunes GB
returns whatever edition it holds, and reissues print titles on artwork the
original never carried. *The Wall* is a bare brick wall; the mzstatic art reads
`PINK FLOYD THE WALL`.

`npm run sleeve-audit` reads the text off every cover with Apple's Vision and
writes `sleeve-cover-text.ts`; the builder refuses any sleeve whose cover names
its own album *or* is simply covered in writing. Of **143 covers read, 103 are
refused**; 106 candidate albums added to refill it. Published **52 → 40**, but
the pack that actually worked was 19. `SLEEVES_MIN_PACK` 45 → 36, which is an
honest bar rather than a loosened one. Depth:
[`decisions/sleeves-gate.md`](decisions/sleeves-gate.md).

**And a wrong picture, not a giveaway.** `resolveAlbum` trusted a hand-typed
`collectionId` with no title check. `californication` carried `947680622` — Red
Hot Chili Peppers' *The Studio Album Collection 1991-2011*. The question showed a
box set and offered *Stadium Arcadium*. It scored **25%** in `53FN`, the worst of
the fifteen, and it was not hard, it was wrong. Green build throughout.

**Not deployed.** 24 new vault ids need `seed-vault` before the pack works at a
reveal, and the difficulty ratings are now systematically wrong — they were set
when the cover named the album.

## 2026-09-21 — The pictures did not turn up, and it was never the files

Bret, Friday 18 September 15:11, with a screenshot; others reported the same on
slow connections. **The files are fine** — 82KB median, 158KB max, 200 from
Pages, 179 of 179 on gh-pages, ~0.2s from here. And in the round he played
(`M9YU`) **file size predicts nothing**: ≥100KB scored 88%/3.9s, under 86%/3.1s.
Shrinking them would have fixed nothing, which is the finding that saved a blind
alley.

Three faults. **Nothing was preloaded** — the `<img>` was created when the
question rendered, the same frame the countdown starts in, though every device
has held all fifteen filenames since the round was built and the lobby sits open
while people join. **The box was zero pixels tall** — `width:100%; height:auto`
with no intrinsic size resolves to 0, and `alt=""` left nothing in the gap, so it
read as a question with no picture rather than a picture that was late; measured
at 0 before, 448×224 after. **A failure was silent and permanent.**

Packs now carry `imageWidth`/`imageHeight`, read off the file header at build
time and written into all 179 stills in place — no id, hash or option touched, so
nothing needs reseeding. The header parser was **cross-checked against `sips`
over all 179: zero disagreements**. Depth:
[`decisions/picture-loading.md`](decisions/picture-loading.md).

**Bret was not blind for the whole round** — eight questions came back 6/6, which
is a 1-in-65,000 run of luck for a guesser. Ask him whether it was a couple of
questions or the lot.

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

iTunes Name that Tune (79 GB previews), Flags (76, hashed), Sleeves (52,
mzstatic hotlink), picture retitled Fine Art, the vault topped up 206, all live
as `index-6odlsKCm`; and On the box via TMDB untitled backdrops, built but not
live. Moved whole on 10 September at 299/300, to keep the CI entry inside
budget: [`recall/2026-09.md`](recall/2026-09.md).

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
