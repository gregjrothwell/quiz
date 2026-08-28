# TOTAL-RECALL

> **Owner: Greg Rothwell. Last updated: 28 August 2026. Budget: 300 lines.**

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

## 2026-08-28 — The rig gets operated

Five phases shared one lighting state. `Stage` now takes a `mood` — only ever the phase, only
from the one call site inside a room — and sets `data-mood`; the whole effect is in the
stylesheet, so a lighting change never costs a render. Two cues, both chosen because they carry
information rather than decoration: **the house dims for the question** (beams 0.7 → 0.3, so
nothing sweeps behind the lecterns while somebody reads and chooses) and **the rig blazes amber
on `finished`**, once.

**The rule this had to obey was already in the file.** Eight of the ten existing animations are
`transform`/`opacity` only; the two that repaint are a 0.5rem dot and four characters. The beams
are the opposite of small — four layers at 16%x95%, `blur(18px)`, blended `screen` — so animating
their colour, filter or shadow would repaint all four every frame, on a phone, mid-clock. Only
opacity moves, and the blaze is a pre-painted layer cross-faded rather than an animated colour.
No fill mode: `both` is what stopped `.tile--dim` dimming for weeks.

**0.34 alpha was invisible and 0.6 is right.** It read fine in the file and did nothing on screen.
Putting the number in front of your eyes is the only way that gets caught. Safe at that strength
because `.beams` is `z-index: -1`, behind the content column, so the wash cannot reach the
contrast of anything anybody has to read. `prefers-reduced-motion` needed no new code — the
blanket rule collapses both durations, so the set still changes state, it just arrives.

**Gotcha, and it wasted a detour: `getComputedStyle` in the browser tool returned a stale
snapshot.** It reported the beams at 0.7 while an inline `opacity: 0.11` was set, which is
impossible on a live page — that was the tell. Every opacity reading taken that way was fiction;
screenshots were the only trustworthy instrument. Do not measure this rig with computed style.

**Not verified:** that `mood={room.phase}` lights up in a real room. Typed and read, but it wants
the live round that four other things are already waiting on.
## 2026-08-28 — A UI audit, and the verdict pills get a thumb

Measured against the built output at 375 and 320 rather than eyeballed. The design holds up on a
phone; these are defects in it, not an argument for redesigning it.

**Fixed: the verdict pills were 80x24** — the smallest targets in the app, on the newest feature,
a few millimetres from Standings at 53px of amber. A near-miss did not just fail to vote, it left
the screen. The cause is in the comment above `.lamp--vote`: `.lamp` is a label reused as a
control, and *"the two things a button needs"* covered cursor and font. **Hit area is the third.**
Grown to 44px with a transparent pseudo-element, so the drawing is untouched — padding would have
inflated the pill, and the pill is deliberately the same object as the lamps it replaces.

Proved with `elementFromPoint`, not computed style: ±21px HIT, ±26px falls through to a container
rather than a control, Standings still hittable at all three edges, the 32 display lamps still
24px with no `::after`, and the screenshot pixel-identical to before.

**`.lamps--vote` is not speculative, and that was worth checking.** Forcing the strip to wrap and
restoring the plain `0.3rem` gap reproduces the defect it prevents: pitch 29px, and the upper
pill's lower half is **stolen** by the pill beneath it. With the guard, pitch 44 and both stay
hittable. A guard that has never been exercised is worth less than no guard.

**Measured, not fixed — Greg's call, and both still open:**

| | worst ratio | needs |
|---|---|---|
| `--ink-dim` `#5d7794`, 25 uses | **3.27** on `--panel-hi` | 4.5 |
| `--cyan-dim` `#0e7ea3`, 11 uses | **3.27** on `--panel-hi` | 4.5 |

`--ink-soft` passes comfortably at 7.4–9.9, so it is specifically the dim pair — and `--ink-dim`
carries the hint text somebody reads once, under pressure, on a phone. Minimal fixes that clear
4.5 on the worst surface: `#708fb2` and `#1197c4`. Also open: the sound toggle at 36px and the
squad filter chips at 30.

**Three things checked and cleared, so nobody re-reports them.** No horizontal overflow at 375 or
320 — the 132 elements past the edge are the beams and the chair overhang, both deliberate and
capped per [`gotchas.md`](decisions/gotchas.md). Reduced motion is properly handled. **Keyboard
focus is fine** — nearly filed as missing after programmatic focus reported `outline: none`, but a
real Tab gives `focusVisible: true` and the UA ring. Reading the gotchas first is what stopped the
overflow becoming a bug report.

## 2026-08-28 — A dependency pass, and four majors held back

Six updates had drifted inside their existing `^` ranges. Lockfile only, and the proof was the
bundle rather than the test count: **every emitted hash came back identical**, and
`index-VtHlbLAd` is what production serves. All six were build tooling. `firebase-admin` moved,
so `check-rules` (47 PASS) and `take-stock` ran against the live project as well.

Then the five majors, each **installed and measured** rather than read off a changelog.
`globals` 17 was free and taken. The other four are held, for four different reasons:

- **TypeScript 7** — our source is *already* TS 7 clean, tests and all. `typescript-eslint`
  refuses to load against it and is targeting TS >= 7.1. Blocked on a tool, not on us.
- **firebase 12** — **+57 kB gzipped** on the chunk every player downloads, isolated to the
  umbrella package by splitting `manualChunks` per package. Nothing in v12 is needed and v11
  has no advisory, so it is 57 kB for nothing. Defer, not never.
- **React 19** (+14 kB gz) and **motion 13** (+3.6 kB gz) — both clean through typecheck, lint,
  513 tests and build.

**The finding underneath those last two is the one worth keeping.** `npm test` sets
`environment: 'node'` and includes `src/**/*.test.ts` — `.ts`, not `.tsx`. **No component is
ever rendered by the suite.** A green run under React 19 is evidence about the engine, which is
pure TypeScript and was never at risk. Both were checked instead against the built output at
`#/preview`, which renders every screen at once: 178 headings, zero console errors, all chunks
200. That is real and still not sufficient — a static gallery exercises no subscription, no
answer window, no phase transition. **Both should ride a real round rather than ship alone.**

→ [`decisions/dependencies.md`](decisions/dependencies.md)
## 2026-08-28 — Squads score during the round

§2, built and live. Hermes against Bundae under the standings, so the round has a second story
in it rather than squads doing nothing until the board afterwards. Zero Firebase cost — the
scores are already in the room and every client holds them.

**It shipped summing the totals and that was wrong.** Greg, on sight: *"Bundae get to play less
than Hermes."* A raw sum means the bigger squad wins by turning up rather than by answering, and
the sides are never even. It now ranks on **points ÷ headcount** — the same complaint and the
same answer as the season table ranking on average. On the gallery fixture that turns Hermes
5,550 against Bundae 3,100 into Bundae ahead, 3,100 a player to 2,775. The screen names the
metric, or the number reads as a total that fails to add up.

**The Lurker split was the flagged trap and it held.** `sideFor` is now one function, shared
with `weekSquad` in `season.ts`, because the running total *becomes* the weekly bucket an hour
later — two copies would look like the room disagreeing with the record, on a screen showing
both. Same reasoning that extracted `liveAnswers`.

**Caught while building:** the room *creator* does not go through `planJoin` — they go through
the reducer's `join` action. Missing that would have left the quizmaster, the one player
guaranteed to be in every room, out of the squad totals on every single round. The existing
comment about `playerId` on that same path is what flagged it.

**Rules paste outstanding, and this one is different in kind.** `playerOk` validates with
`hasOnly`, so a join write carrying `squad` against the old ruleset is refused outright and
**nobody can join a room at all** — not "the feature is inert", which is what the vault and the
vote failed to. `check-rules` currently FAILs on it and its hint says exactly that.

**Audit for regressions, asked for and worth recording.** `sync-harness 6` came back 6/6 with
old-shape entries, so clients a deploy behind still join — the backwards-compatibility case that
`hasOnly` could have broken. The `squad` field was read back out of the live room document to
prove the client sends it rather than assuming the rules accepting a join meant it did. One
genuine finding: the live board reads the squad off the room entry, frozen at join, while
`recordGame` banks storage at the end of the game — change squad mid-round and they disagree.
Documented rather than fixed.

513 tests. `season.md` hit 282/250, so the live board split to `decisions/live-squads.md`.
→ [`decisions/live-squads.md`](decisions/live-squads.md)

## 2026-08-28 — A reload keeps your seat

§10, written down this afternoon and shipped the same day. `code` was React state in `useRoom`
and nothing persisted it, so refreshing mid-round dropped you to the landing screen.
`rememberedRoom` is session storage — this tab tonight, not this browser — and leaving clears
it, which is the whole risk and has its own test.

Proved both ways in the browser: reloaded at a bare `/quiz/` with **no join link in the URL at
all** and came back into room NPRF with both players listed; then left, reloaded again, and
stayed on the landing screen.

**Two things the fix nearly broke, both caught rather than shipped.** `nameRef` starts empty
after a reload, and the rejoin path writes it into the players map when the reaper has removed
somebody still playing — a nameless plate on everybody's board. Now seeded from storage. And
the auto-join effect declared `const code = linkedCode`, which **silently shadowed** the room
code from `useRoom`, so `inRoom` read the link's code, was never null, and auto-join could not
fire at all. Types and lint both passed — two strings with the same name. Only following the
link in a browser found it.

497 tests.
→ [`decisions/joining.md`](decisions/joining.md)

## 2026-08-28 — The ideas list re-sorted around what shipped

`ideas-review.md` said "nothing here is built" and five of its entries now are. Re-sorted rather
than appended to, because a backlog that does not know what it has already delivered ranks the
rest wrongly.

**§6 turned out to be two ideas**, and the office's feedback is what separated them: *quality*
and *difficulty*. An unfair question is not a hard one. The vote shipped; the `asked/correct`
counters did not, and are still worth starting early because they are worthless until a season
is behind them.

**§4, the melody round, is unblocked** — its stated blocker was "it wants the shared clock
first", and that shipped this morning.

Three new entries, all from this session: **§10 the reload bug** (the only defect on the list),
**§11 pick the retirement thresholds from real votes** (must happen before the first `--go`,
since retirement is permanent), and **§12 a tally on the vote** — cheap, but noted as worth
thinking about first, because a visible count does some of what not exposing Skip avoids.

**The new order leads with three things that are not features**: a real round with the office on
it, the thresholds, and the reload bug. Three features shipped this week and only one has met
more than one person at a time — the app is ahead of the evidence again.

Split at 283 lines against 250: the closed half — decisions taken, what was rejected, what
Spark allows — is now `decisions/scope.md`.
→ [`decisions/ideas-review.md`](decisions/ideas-review.md)

## 2026-08-28 — Voting and auto-join are live, and proved on the deployed site

Rules pasted by Greg, then PRs #9-#12 merged and deployed in order. New bundle `index-Dtk7kXAa`,
CDN watched until it served it. **`firebase-Cns3pSRr.js` kept its hash across the deploy**,
which is the split-chunk design in `known-limits.md` doing exactly what it claims.

**`check-rules` after the paste is the evidence that matters.** The two vote *allow* cases
flipped FAIL -> PASS, and the six *deny* cases stayed PASS — but they now mean something, where
before the paste they passed vacuously because with no rule at all everything is denied. That
distinction was called out in the PR rather than reported as eight green ticks.

Proved end to end on the live site, in one round: the link auto-joined as OfficeTest with no
landing screen; the answer scored `CORRECT · +1,000` at 8.9s against `scored: OfficeTest +1000`
in the terminal; the vote was clicked 213ms after the reveal landed, the pill lit and the label
went to "Noted"; and `fold-votes` read it back with the Admin SDK — **`1 verdicts across 1
questions`, nothing retired**, because one vote is under the five-vote floor. The refusing
direction, on production.

Catching the 8s reveal window needed a watcher injected into the page — the tool round-trip is
longer than the window, and two attempts were lost to it before that.

Also: `MEMORY-PROTOCOL.md` and `standards/docs.mdc` now both carry the archive convention, so
Cursor sees it too.

## 2026-08-28 — The office can vote a question out

Office feedback on question quality. Players rate a question at the reveal; the verdicts fold
back into the packs as a retirement list. **Built, rules paste outstanding.**

Shape, and the three reasons it is a global collection rather than a room one: no reads (an
in-room collection is another `Q·N²` term, ~+540 a game at six players), it outlives
`prune-rooms`, and the uid as document id deduplicates it for free. The document is one field,
`good` or `bad` — no option index, so it cannot leak what the vault protects. 90 writes a game,
no reads. `shouldRetire` is 5 votes and 60% bad, in the engine so `npm test` covers it.

**The trap:** deleting a question from `public/packs/` retires nothing, because
`fetch-questions --resort` rebuilds the packs from `.cache/` and would resurrect it silently.
So `src/questions/retired.json` is the record and the packs are downstream; `seal.test.ts`
now checks no retired id is back in a pack. 482 tests.

**Two corrections made while building.** `delete: if false` on the vote path was written first
and was wrong — it buys nothing, since `update` already lets anyone flip their own verdict, and
it costs a row no client can remove, which is exactly the `prune-rooms --probe-rows` litter
this repo already had to sweep once. And `check-rules` currently passes all six *deny* cases
for the wrong reason: with no rule published, everything is denied. They only prove anything
after the paste.

`questions.md` hit 259 against its 250 budget, so this **split** into
`decisions/question-votes.md` rather than being tidied — the harvest pipeline and what the
office does to it afterwards are different subsystems meeting at `public/packs/`.
→ [`decisions/question-votes.md`](decisions/question-votes.md)

## 2026-08-28 — The join link goes straight into the room

Office feedback: following the link still costs a press on a screen that already knows both
answers. `shouldAutoJoin` (`src/engine/autoJoin.ts`) skips it. Written as a **list of
refusals** — no code, no remembered name, whitespace name, not signed in, not connected, link
already used, already in a room — because the refusals are the half worth testing. All of them
fall back to exactly today's landing screen with the code filled in. 11 tests, 459 total.

**The Lurker is the one refusal about the game rather than readiness.** Their side lives in
session storage on purpose, so a fresh session has a squad and no side; auto-joining would
bank their week to Lurkers instead of whoever they sat with, and nobody would see it happen.
Verified live: name and code both present, still refused, and the landing screen put the
"playing with" picker up. An empty squad is *not* the same case and goes straight in.

Proved in both directions in the browser: a cleared browser lands on the landing screen with
the code filled; a browser holding a name goes straight in; the lobby then says *"The link
brought you straight in as Linky, playing for Hermes"* with **Not you? Start again**, which
returns to the landing screen without re-joining. A room created by hand shows no such line.
→ [`decisions/joining.md`](decisions/joining.md)

## 2026-08-28 — The shared clock is live, and has been played

Merged [PR #8](https://github.com/gregjrothwell/quiz/pull/8) and deployed. Eight commits: the
shared clock, the rank-scoring rename, the host-room answers fix. The CDN was watched until it
served `index-AUAGmZGO.js` rather than assumed.

**First round anybody has played on the shared clock.** Room PMVP, 20s window, answered from
the keyboard at 10s showing: browser `CORRECT · +1,000` stamped 10.6s, terminal
`scored: ClockTest +1000` at 10.79s after open. The two agreeing is the evidence; the 0.19s
gap is write latency. Clears **keyboard shortcuts in a live round**. Ranking still unproven —
one answerer cannot show an order.

Re-run before merging: 448 tests, `check-rules` both directions, `sync-harness 10` (host +4ms,
other nine +50–53ms), `reveal-probe` accepted at 10005ms.

**Found, not fixed:** a page reload drops you out of the room — `code` is React state in
`useRoom` and nothing persists it. Pre-existing. Now in the handover's Outstanding list.
## Earlier — the full chronology, archived

Thirty entries, moved on 28 August 2026 and unchanged. Newest first, as above.

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
