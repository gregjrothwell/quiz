# A lead-in before each question

> **Owner: Greg Rothwell. Last updated: 25 November 2026. Budget: 250 lines.**
> **Status: built 25 November 2026, not live.** PROJ-179, [#211](https://github.com/gregjrothwell/quiz/pull/211). Greg, 11 Nov: "add in and
> build"; 25 Nov: start it. What was built is at the end. Above it is the costing as written on 11 Nov: proposal 4 of
> [`ui-ux-review.md`](ui-ux-review.md), which called it "L, touches the rules" as a guess.

**The answer: it does not have to touch the rules.** A lead-in can be a hold on the room's shared
clock, the way Catchphrase already holds its options for half the window. That is client and engine
only, about **2–3 days**. The version that needs rules, a new phase and every harness is a different
design, and it is not the one to build.

## What a lead-in is

"Question two" → the picture → the prompt → the four answers, about two seconds in all, and only
then does the clock start to drain. It is the architect's "fade in of the question and answer" and
his "animations that take you between rounds" in one move (Greg relaying him, 10 Nov 2026).

## Two ways to build it

| | A. Inside the window | B. Before the window |
|---|---|---|
| How | The question opens as now. Every screen holds the answers for *L* seconds of the shared clock, then the answering time runs | A new room phase shows the lead-in; the host's device then writes a second time to open the question |
| Rules | **None** | Phase list in two places, `opensAQuestion`, a publish before deploy |
| Writes per question | Same as now | One more room write, fanned out to every seat |
| Depends on | Each device's own clock, corrected to the server's | The host's device firing a timer on time |
| A seat that hears late | Sees a shorter lead-in and **still gets the whole answering time** (from question two; question one is uncorrected) | Hears the lead-in late and the question late |
| Who sees the prompt early | Everybody, by *L*. Equal, and added to the window so nobody loses answering time | Nobody |
| Size | **M: 2–3 days** | L: a week or more, plus every harness and e2e spec that walks phases |

**B is the design the repo has already turned down twice in spirit:** the opening titles were made
a lobby state because a sixth phase costs a rules change, and the round's start was taken off a
`setTimeout` after one round played on it ([`gotchas.md`](gotchas.md), "The opening titles are a
lobby state" and "Nothing starts a round on a timer"). Recommend A.

## Why A needs no rules change — each read in the code, 11 Nov 2026

- **Rank is `elapsedMs` ascending and nothing else.** `src/engine/scoring.ts:133` and `:224`;
  `grep -n durationMs src/engine/scoring.ts` returns nothing, so the window no longer feeds points.
  Holding everyone's answers for the same *L* moves every stamp by the same amount and no rank.
- **Stamps stay measured from `openedAt`**, so `arrivalOk` (`firestore.rules:576`, floor
  `arrival − openedAt − 8000`) and the reducer's "not past the window" check
  (`src/engine/reducer.ts:365`) are untouched.
- **The reveal gate is `openedAt + durationSecs`** (`firestore.rules:686`). If the room's
  `durationSecs` is the chosen time plus *L*, the gate, the host's auto-reveal
  (`src/engine/revealGate.ts`) and the 3-second wait for a slow write (`src/host/due.ts`) all follow
  with no change. The rules accept 5–120 whole seconds (`firestore.rules:289`), so 12, 17 and 22
  are legal today.
- **The hold itself is already built once.** `optionsDue(elapsedMs, holdAt)` gates the tiles
  (`QuestionScreen.tsx:390`, `disabled` at `:647`) and the A–D keys (`:505`). A walked-in player
  skips it (`:390`), which is the behaviour a lead-in wants too.
- **The room document has no key whitelist** (`wellFormed`, `firestore.rules:329`), so if *L* is
  ever stored on the room rather than in the bundle that is not a rules change either. *Read, not
  tested against the emulator.*

## What A does touch

1. **New `src/engine/leadIn.ts`** (pure, tested): *L*, "is the lead-in over", and the answering
   clock (`elapsed − L`, `duration − L`).
2. **`QuestionScreen.tsx` and `global.css`**: the staged entrance; tiles and keys held until *L*; the
   ring and the seconds count the answering time, full until it starts.
3. **`start` in the lobby**: the room's `durationSecs` becomes the choice plus *L* — or the lead-in
   is taken out of the choice (decision 1).
4. **Three dials that are shares of the window** must be shares of the answering time:
   `optionsHold.ts` (Catchphrase, half), `catchphraseBonus.ts:49` and `jigsaw.ts:36` (squares and
   tiles by tenths), plus `songClue.ts` (when a song starts).
5. **Every place a time is shown** subtracts *L*: the reveal's "1.2s" on a tile
   (`PodiumTile.tsx:88`), the fastest-finger award (`Awards.tsx:30`).
6. **Scripts that print "tap 3.1s of 10s"** (`read-traces`, `read-games`, `audit-players`): their
   baselines move by *L*. Either they subtract it or the docs say so the day it ships.
7. **Sound**: nothing plays when a question arrives today (see the review). A lead-in wants one
   short cue, and a tune should start when the answers land, not before.
8. **e2e and CI time**: every question played by a spec takes *L* longer. Not counted.

**Not touched:** `firestore.rules`, `database.rules.json`, the vault, `useQuestionClock`'s
arithmetic, the shared-clock correction, scoring, the season, `rank-harness` (without `--browser`
it writes its seats' stamps itself; `scripts/rank-harness.ts:159`, `:323`).

## What it costs the room

- **Round length**: +*L* a question. At 2 seconds, 20–50 seconds on a round of 10–25.
- **A mixed room on deploy day**: a seat still on the old bundle shows its answers at once and can
  answer *L* early. The Catchphrase hold is a bundle constant too (`OPTIONS_HOLD_SHARE`), so it had
  the same gap on its own deploy day — *my inference, not a recorded event*. Deploy outside playing
  hours.
- **A crafted client can answer during the lead-in.** It can already stamp `elapsedMs: 0` inside
  the 8-second grace ([`answer-window.md`](answer-window.md), 21 Sep). Nothing new opens.

**What it does not fix:** Cass's question one. Her problem is a slow write, not a late question
([`cass-q1.md`](cass-q1.md): "seen late 0.0–0.1s"), and question one is the one question the
shared clock does not correct.

## Story (draft — not approved)

**As** a player at my desk, **I want** each question to arrive in order — its number, its picture,
the question, then the answers — **so that** it feels like a show and I am reading before the clock
runs.

1. From the question opening, the answers appear at *L* on the room's shared clock, on every screen
   together; nothing can be answered by tap or key before then.
2. The ring and the seconds show the answering time and do not move during the lead-in.
3. The answering time is what the quizmaster chose in the lobby (if decision 1 is "add").
4. A seat that receives the question up to *L* late gets a shorter lead-in and the full answering
   time (question two onward).
5. A player who walks in mid-question sees no lead-in.
6. Reduced motion: the same hold, no movement.
7. Rank for a given set of taps is unchanged — `rank-harness` passes as it does today.
8. Catchphrase, tunes and sleeves behave as decisions 3 and 4 say.

## Decisions — all Greg's

1. **Add *L* to the window, or take it out of it?** Add keeps "10 seconds" meaning ten seconds of
   answering and makes rounds longer. Recommend add.
2. **How long?** Recommend 2 seconds. Kahoot's Team mode is said to show the question alone for 5
   (search summary, not verified; see the review).
3. **Catchphrase**: it already plays alone for half the clock. Recommend no extra lead-in there,
   only the staged entrance.
4. **Tunes and sleeves**: does the song start with the lead-in or when the answers land? Recommend
   when the answers land, so the first two seconds are not a head start for whoever knows the intro.
5. **Whether to build it at all before the small fixes** (proposals 1, 2, 3 and 5 of the review).

## Not covered

Nothing here was run. The mixed-bundle head start, the e2e time and the room-document field are
read from code. `shared-clock.md`'s own open item still stands: ranking under the corrected clock
has not been proved on two real devices on the office network.

## What was built — 25 November 2026

Design A, as costed: **no rules change, no new phase, no extra write.**

- **`src/engine/leadIn.ts`** holds it all: two seconds, none on a Catchphrase round. `openRound()` is the one way the app opens a
  round, and `openRound.test.ts` reads the source to keep it so. A harness that builds its own `start` has no lead-in, so
  `rank-harness`, `sync-harness`, `final-harness` and the rules specs play exactly what they did. `host-room` uses `openRound`.
- **`leadInSecs` on the room**, beside a `durationSecs` that is the choice plus two. The vault's gate, the auto-reveal and the 3s
  hold follow with no change. A room an old tab opened has no field, so it has no lead-in. The lobby remembers the choice, not the sum.
- **Answers stay stamped from the open** (`arrivalOk`). `answeringTimes()` takes the lead-in off where a time is kept or shown: the
  reveal chips and "not locked", the device log (so the fastest finger), `games/` and its `durationSecs`, and the tie-break's
  count, which adds two halves of The Double that can have different lead-ins.
- **The lecterns are invisible until the answers land**, keeping their words and their key hint so no box changes size, then come in
  90ms apart. The number, picture and prompt arrive at 0, 0.15 and 0.4s. The ring is full and still. One cue, `arrive`.
- **A tune or a melody starts with the answers**, and its replay button and `R` wait too. The clip is fetched meanwhile.

### Assumed while building — 1 and 2 settled by Greg, 25 November 2026

1. **Two seconds**, and **a tune starts with the answers**: recommended on 11 Nov. **Greg: yes.**
2. **Greg: ok.** **A Catchphrase inside a Random Round gets the lead-in** (then half the answering time alone), because the rules pin one window
   for a whole round. A Catchphrase round has none.
3. **`games/` keeps answering times**, so a 15s round still reads 15s and its medians compare with every round before. A record's
   `at` less `elapsedMs` is therefore two seconds after the open.
4. **Question-one traces stay raw**: "tap 5.1s of 12s" is 3.1s of 10s.

### Evidence

- 2,495 unit tests. **17 deliberate breaks: 16 caught, one equivalent** (`ArcTimer` clamps the ring itself). The first run of that
  check reported all 15 caught and was wrong: its command failed on unbroken code too. It was rerun against a green baseline.
- **Emulators, through the app and these rules:** `lead-in.spec.ts` (new), `q1-trace`, and `host-writes`, a whole round to Share or
  Shaft. Its golden gained `durationSecs: 12, leadInSecs: 2` by hand and matched without being re-recorded.
- **Filmed, four seats, every frame sampled** (`.cache/ux-film/179/`, not in git), question two: answers enabled at 2.000–2.017s;
  ring at 0 offset and "10" throughout; "9" 1.0s after landing. Lectern boxes identical before and after, which the first film was
  not (9px, fixed). Reduced motion: the same hold, all four at rest 16ms after landing.
- **AC4, a seat held still 1.3s:** it saw question two 1.25s late, had an 0.8s lead-in, and its answers landed 48ms after the host's
  with the full ten seconds left.

### Not covered

The office network and a phone. ~~Sound was not listened to, on a tune least of all.~~ **Greg listened on 25 November 2026**, on a board
that played this branch's own `sound.ts` and `QuestionScreen`: the cue "ok for now", a tune after the two seconds "ok". Measured on it:
songs start 2.02–2.06s after the press, the clock bed at 3.0s, the gong at 12.0s. The low synth and the clock's synth are to sound more
premium later (PROJ-202). Question one is uncorrected, so a seat that hears
it late lands late there, as it always has. No screen reader. The mixed-bundle head start was reasoned, not run.
