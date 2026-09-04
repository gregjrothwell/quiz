# TOTAL-RECALL

> **Owner: Greg Rothwell. Last updated: 4 September 2026. Budget: 300 lines.**

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

**Split again on 4 September 2026**, at 350 lines. The two 2 September entries
went to [`recall/2026-09.md`](recall/2026-09.md) and 29 August joined
[`recall/2026-08.md`](recall/2026-08.md), which is why that file is no longer
titled "up to 28 August". Same rule, same reason: moved whole, not shortened.
Verified after the move rather than assumed — the three entries diffed byte-for-byte
against the spine they left, and all 128 relative links across the spine, both
archives and the handover resolve.

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

## 2026-09-04 — Live, and the CDN lied for a minute

Merged and deployed. `master` at `1743357`, gh-pages at `20155bf`, bundle
`index-BOq4sYDx`.

**Verified rather than assumed, and the first reading was wrong.** Immediately
after the deploy the live `index.html` still referenced `index-Y1gzBmfb` — the
bundle from 2 September. gh-pages already held the new one, so the artifact was
right and the CDN was stale, which is exactly the failure this project's docs
warn about and the reason "watch it onto the CDN" is the standing instruction.
It caught up within a minute of re-fetching.

Checked in this order, because each step rules out a different cause: what is
*in* the gh-pages commit, then whether the deployed bundle actually contains the
new strings (`got there first`, `Your squad`), then what the CDN serves, then the
live page in a browser — 200s on the bundle, the Firebase chunk and the packs,
landing screen rendered, **no console errors**.

**The Firebase chunk hash did not move** (`firebase-Cns3pSRr`), which is the
split doing its job: a returning player re-fetches 236 kB, not 724 kB.

**Still never played.** The steal is opt-in and off by default, so tonight it
changes nothing unless a quizmaster picks it. 5% remains a reasoned guess.

## 2026-09-04 — The mute button, and a squad nobody could pick

**The mute button** was transparent-on-transparent over the studio backdrop,
which is beams of light rather than a flat colour: fine on a dark stripe,
invisible where a beam passed under it. It has a dark ground and an edge now.

**The squad gap is the one that cost data.** Auto-join, shipped 28 August, takes
a player from a link straight into the room — skipping the landing screen, which
was the only place a squad could be chosen. `App.tsx` even says of that path that
"the lobby can offer a way out without this needing to know about it". The lobby
never did: its `squad` prop only *displayed* "playing for X". The other control,
`SquadPanel`, lives on the season board and renders only for somebody who already
has a row there — which a first-timer does not. So a link-joiner with nothing
remembered could not pick a side at all, and banked without one. **A feature
shipped in August quietly removed the only route to another one.**

Fixed with a picker in the lobby writing the same store the banking reads.
**Half-fixed, honestly:** the *live* squad board still misses them for the round
they fix it in, because it reads `players.{uid}.squad` off the room and nothing
can write that after a join — `writeSelfIntoRoom` is unexposed and the reducer's
`join` deliberately refuses an existing player. Outstanding #4.

## 2026-09-04 — The first right answer steals from the leader

**Built, unplayed.** `round-types.md` ranked it third and XS4A is why: the wager
swung the top by 22,800 and could not touch the two players holding nothing, and
a share of your own points is worth nothing when you have none. A steal pays the
answerer out of the leader, so it reaches exactly those people.

Opt-in from the lobby like the wager, but every question rather than the last,
and the two compose. A **share** of the victim's score — the wager's load-bearing
decision, so nothing goes below zero and the season row is untouched. **Nobody
steals from themselves**, which makes it self-limiting rather than a tax. It
**moves** points rather than making them: the round's total is identical before
and after, asserted rather than assumed. Zero reads, zero writes, no paste.

`STEAL_SHARE` is 5% and is the dial. Everything else is settled.

**Proved, not reasoned.** The branch had been claiming "no paste needed" off a
reading of the repo ruleset, which is the least evidenced thing on it and the
most expensive to be wrong about — `playerOk` uses `hasOnly`, so a refused room
write is a room nobody can start or join. `check-rules` now writes a live room
carrying `stealEnabled` and `lastSteal`: **PASS, 52/52**. `sync-harness 10`
after it: **10/10, 0 dropped, all ten inside 56ms**.

`lastSteal` sits on the room beside `lastDeltas` because the reveal has to *say*
what happened — a net delta cannot be read back into "Priya took 500 off you",
and without it a robbed leader saw "You didn't answer · −500" and no reason.
That is the wager's fifth trap, caught this time before it shipped.

**The glint fix**, same day: the winner's riser swept its band of light across
the whole stage, because it moved the *element* rather than the gradient inside
it and `.riser` sets no `overflow`. [`decisions/lighting.md`](decisions/lighting.md).

572 tests. Details: [`decisions/round-types.md`](decisions/round-types.md).

## 2026-09-04 — The chair seats everybody, and the prose was wrong

**Fixed.** `seatedLast` always returned the whole tie for last; both renderers
collapsed it, so people tied for last were one figure labelled "A & B & C". They
now pile onto the one chair. The viewBox does **not** grow — `.seat__chair` is
sized by `max-width`, so a wider box renders it shorter and the height is the
joke; measured 88×127 at one, two and three. Offsets in `engine/seat.ts` so the
screen and the PNG cannot drift.

**Correction, and the more useful half of the day.** This session repeated
`HANDOVER.md`: that the wager and the rank bonus had never been played. **Both
were false.** Greg said so and one query on `rooms` proved it. Outstanding #3 now
names what is genuinely untested, and the fix is a command rather than a
discipline — `take-stock` reports the last ten rounds as of today, ten reads that
would have caught both. It reads the wager and the bonus off the *scores* rather
than the flags: only `stakeFor` makes a total that is not a multiple of 100, and
only a bonus below first makes one that is a multiple of 100 but not of 1,000.

**A second, smaller correction, same day.** The chair commit says room XS4A
finished with three players on zero. Its scores map does; one of the three had
left, and scores outlive membership, so `roomStandings` seats two. YS8F is the
clean two. Wrong in the commit, right in the docs — history is not rewritten.

**A third correction, and it moved the backlog.** The negative-points section
claimed a minimum stake targets the case the live rounds show. It does not, and
the mistake was reasoning rather than looking. XS4A's last question: Not Bret and
Greg both staked 100% and were right, Amier and Alistair both staked 100% and
were wrong — and finished on **0**, because they reached the last question
already on zero and 100% of nothing is nothing. They tie at the bottom because
they scored nothing in twenty-five questions, and two people who scored nothing
are genuinely level. **Nothing breaks that tie, because the tie is real** — the
chair was the right fix and the whole fix. Negatives demoted below the steal.

**Decided, not built: negative points, through to the season row** — two lines
out of `firestore.rules`, a `>= -maxPoints()` floor in, paste before deploy.
Nothing produces a negative yet; a minimum stake would, and needs no paste.

Four round types costed — steal, picture, music, jigsaw. **None is limited by the
database.** All of it: [`decisions/round-types.md`](decisions/round-types.md).

## Earlier — the full chronology, archived

Thirty-seven entries, moved on 28 August, 2 September and 4 September 2026,
unchanged. Newest first, as above.

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
