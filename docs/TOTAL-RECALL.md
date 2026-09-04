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

## 2026-09-02 — Both went live the same afternoon

PRs #18, #19 and #20 merged and deployed. **The paste went first and on its own**, which is
worth recording as a pattern: the ruleset change was purely additive — `hasOnly` widened by one
key, the new bound guarded by `!('wager' in ...)` — so publishing it before anything was merged
or deployed could not affect a single client then playing. That decoupled the one step only Greg
can do from everything else, instead of stacking it in the middle of a deploy.

`check-rules` after the paste: `stake points on your own answer` **FAIL → PASS**, and its two
deny neighbours went from vacuous to meaningful in the same moment. Bundle `index-Y1gzBmfb`
watched onto the CDN over ~45 seconds; `firebase-Cns3pSRr` kept its hash. Both features
confirmed on the deployed site, not locally.

**A boundary worth knowing about:** the harness blocked `gh pr merge` mid-session, having allowed
`git push` minutes earlier. Not a rule of Greg's and not a judgement — and the first answer given
for why the merge could not happen was wrong: CORE.md names Greg as merger by *default*, not by
prohibition. Worth separating next time: what the rules forbid, what the tooling blocks, and what
is merely convention.

## 2026-09-02 — The repeats, and a wager that had never existed

Two pieces of office feedback, and both turned out to start from a wrong premise.

**The wager was never built.** Greg had pitched it verbally at the last round and the office
liked it; someone then suggested betting every round. No code, no branch, no commit on any ref
— it was `ideas-review.md` §3 and nothing else. Built as costed: last question only, opt-in from
the lobby, **a share of the points you hold rather than a number of points**, which is what keeps
a total off negative and keeps this to **one** ruleset paste instead of two. Zero extra reads and
writes — it rides the answer document. **The paste is outstanding**; `check-rules` fails on its
allow case until then, and its two deny cases pass *vacuously* in the meantime.
→ [`decisions/wager.md`](decisions/wager.md)

**The squad suspicion on the repeats was half right, and the wrong half is the useful one.**
`selectQuestions` is unchanged since 1 August. But `7d25cac` is an ancestor of the squad branch,
so it reached the office in the same deploy — and it made `recordAsked` take `previous` from the
caller, where a failed read had already been degraded to an empty set. **One transient failure
overwrote up to 400 remembered ids with that round's fifteen**, permanently and silently.

**The measurement then moved the work.** `asked-probe` (new, read-only) showed the history was
in fact accumulating — General Knowledge sat at exactly 400, the old cap, so the fix there was
raising it to 500, the most the published rules allow without a paste. Cross-referencing the
asked ids against the packs found the real cause: **Best of British had served 54 of its 54 easy
questions**, Sport 12 of its 15 hard ones. The Ladder takes 30% from each end every round, and
only ~4,000 of 14,176 questions carry a real rating. Gentle and Fiendish are withdrawn.

**The plan's per-difficulty repeat fallback was measured and then not built.** With buckets that
thin it would have served a repeated hard question every single round — injecting repeats into
the complaint being fixed. Six rounds simulated against the real live history: **zero repeats**.
What it costs is the ladder itself, which now loses its top rung by round five on General
Knowledge. That is a `stats/{questionId}` problem, and it is in Outstanding rather than papered
over.

**Proved by a comparison, not a number**: `tv-and-film` **40 → 55** across one real round in the
browser. The refusing direction is unit-tested only, because forcing it live would mean
publishing a broken ruleset — said rather than implied.
→ [`decisions/repeats.md`](decisions/repeats.md)

**Two corrections and one admission.** The handover had claimed two WCAG failures fixed a week
earlier and three branches undeployed that were live; `security.md` still said the RTDB and auth
were unenforced, under a heading saying "still open", a fortnight after its own summary said
otherwise. All corrected in place. And **the first commit of the repeats work carries all four
changes while its message names only one** — `git add -A` where three commits were wanted. Not
rewritten, because that rule does not bend for tidiness; recorded here instead.

29 merged local branches deleted. `cursor/fastest-finger` still holds a 583-line rank harness
that exists on this disk alone.

## 2026-08-29 — A design review lands, and four of its six get built

Claude Design produced a sixteen-finding UI/UX review on its own canvas. **Getting it into
Claude Code needed `/design-login` run once from an interactive terminal — the canvas URL alone
unblocks nothing**, and the failure only surfaces after the design work is done, in the other
tool. Credential goes to the Keychain, so there is no file to check for.

Built its items 1–4 and 6, each verified in the browser against the built stylesheet rather
than by tests, which touch no CSS: **`.chip` was declared twice with `.chip--hard` between
them**, so source order killed the difficulty signal on every question header — a shipped
feature silently dead. Renamed the league filter to `.filter-chip`. Both dim tokens raised past
AA with headroom. The level picker now says "expect repeats" below three times the round
length. The player's reveal, alone among five screens, never said the room was waiting on the
quizmaster; it does now.

Two things worth carrying. **The review undercounted twice** — three call sites that were four,
six inline hint styles that were eleven — so its numbers are a lead, not a fact. And **the
design gallery had every quizmaster/player pair except at the reveal**, which is how the empty
desk survived: the missing fixture was the reason nobody saw it.

Items 5 (recovery code as a button) and the `--screen`/`--section` merge are left as design
calls, not renames. Branch `design-review-fixes`, five commits, unmerged.

## Earlier — the full chronology, archived

Thirty-four entries, moved on 28 August and 2 September 2026, unchanged. Newest first, as above.

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
