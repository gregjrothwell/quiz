# TOTAL-RECALL

> **Owner: Greg Rothwell. Last updated: 29 August 2026. Budget: 300 lines.**

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

## 2026-08-29 — The review's remaining findings, merged and deployed

The rest of the review that needed no design decision: 44px hit areas on the
sound toggle and the filter chips, the unreachable `.tile--dim` deleted, the lit
edge declared once instead of five times, two radius steps named.

**The chips needed something the review missed.** They wrap, and at the old
0.4rem row gap the rows sat 36.9px apart while each hit area is 44px — they
would have overlapped and the top of a lower chip would have become unhittable,
which is worse than the 30.5px it replaced. `row-gap` to 0.85rem takes the pitch
to 44.1px. Same fix and same reasoning as `.lamps--vote`, which had solved it
once already.

Merged as [PR #17](https://github.com/gregjrothwell/quiz/pull/17) and deployed.
**22 commits, only 9 from the session** — the other 13 were the unmerged
handover-and-context line including a major `globals` bump, flagged as unverified
and shipped on Greg's call.

Three instrument failures on the day, all caught the same way:

- The first live reading after deploy showed the **old** build. The browser held
  pre-deploy HTML under `max-age=600`, so the chips read as grey pills and looked
  like the fix had not shipped. Checking the served CSS hash is what caught it.
- A verdict read `Correct · +0` — sampled 2.7s in, but `ScoreTicker` is passed
  `settled ? myDelta : 0` and shows zero until the replay settles. The host had
  scored +1000.
- The first regression sweep reported 442 unexplained differences. The
  measurement was wrong, not the code: comparing flat across the page counted the
  added fixture's duplicate QuestionScreen. Per-screen comparison gave 0.
- A link checker then reported all 37 archive anchors broken, including 30 that
  predate the change. GitHub turns ` — ` into `--` because it replaces each space
  singly; the checker collapsed the run.

**Three `PERMISSION_DENIED` writes per reveal are the vault, not a fault** — the
rule refuses the three wrong candidates and permits the right one, exactly as
[`decisions/vault.md`](decisions/vault.md) describes.

Proven in a live room against the deployed site, terminal as quizmaster: the
difficulty chip renders as a cyan tag on real pack data, the forced `hard`
variant is red, and a player's reveal now reads "Waiting for the quizmaster to
show the standings…" with no button row.

**Pre-existing, reported not fixed:** twelve orphaned `host-room` processes from
28 August have been holding Firebase connections for over a day.

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

## 2026-08-28 — The rig gets operated

Five phases shared one lighting state. `Stage` takes a `mood` — only ever the phase — and the
stylesheet does the rest, so a cue costs no render. **The house dims for the question** and
**the rig blazes amber on `finished`**. Only `opacity` moves: the beams are four blurred,
`screen`-blended layers, and eight of the ten existing animations were already compositor-only,
which is where the rule came from rather than from taste.

Two things worth carrying: **`0.34` alpha was invisible and `0.6` is right** — it read fine in
the file and did nothing on screen. And **`getComputedStyle` returned a stale snapshot**,
reporting the beams at 0.7 while an inline 0.11 was set. Screenshots were the only trustworthy
instrument.
→ [`decisions/lighting.md`](decisions/lighting.md)

## 2026-08-28 — A UI audit, and the verdict pills get a thumb

Measured against the built output at 375 and 320. **The verdict pills were 80x24** — smallest
targets in the app, on the newest feature, millimetres from Standings. The cause was in the
code comment: `.lamp` is a label reused as a control, and *"the two things a button needs"*
covered cursor and font. Hit area is the third. Grown to 44px with a pseudo-element, so the
drawing is untouched. Proved with `elementFromPoint` rather than computed style.

**The wrap guard was made to earn its place**: forcing a wrap with the old gap reproduces the
defect — the upper pill's lower half is stolen by the pill below. A guard that has never been
exercised is worth less than no guard.

Two contrast tokens fail AA and three findings were checked and cleared; both recorded in
[`decisions/state-of-play.md`](decisions/state-of-play.md#the-ui-measured--28-august-2026).

## 2026-08-28 — A dependency pass, and four majors held back

Seven in-range bumps, lockfile only. **The proof was the bundle, not the test count** — every
emitted hash identical, and `index-VtHlbLAd` is what production serves. `globals` 17 taken.
Four majors held, each installed and measured rather than read off a changelog: TypeScript 7
(our source is already clean; `typescript-eslint` refuses to load), firebase 12 (**+57 kB
gzipped** for nothing needed), React 19 and motion 13.

**The finding underneath the last two:** `npm test` is `environment: 'node'` over
`src/**/*.test.ts` — `.ts`, not `.tsx`. **No component is ever rendered by the suite**, so a
green run under React 19 is evidence about the engine, not about React.
→ [`decisions/dependencies.md`](decisions/dependencies.md)

## Earlier — the full chronology, archived

Thirty-seven entries, moved on 28 and 29 August 2026 and unchanged. Newest first, as above.

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
