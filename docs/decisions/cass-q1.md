# Cass loses question one

> **Owner: Greg Rothwell. Last updated: 21 October 2026. Budget: 250 lines.**

Follows [`office-feedback-9-oct.md`](office-feedback-9-oct.md) §1 and §5, whose leading
hypothesis this replaces. Read off live `games/` with the Admin SDK on 21 October 2026, every
round of three or more seats back to 9 September (one-off scripts, read-only; the method is
below so it can be rerun).

## The story

> As a player, when I answer question one in time, I want it scored — or told plainly why not.

Greg, 21 Oct: Cass still gets no points on question one, is sure she answered right and in
time, and sees no message.

## What the kept rounds say — verified 21 Oct

**It is the 10-second window.** Cass's question one, by the round's window:

| | Q1 missed | later questions missed |
|---|---|---|
| Cass, 10s rounds | **8 / 24 (33%)** | 5 / 326 (1.5%) |
| Cass, 15s rounds | **0 / 22** | 1 / 288 (0.3%) |
| Everyone else, 10s | 11 / 122 (9.0%) | 69 / 1,643 (4.2%) |
| Everyone else, 15s | 11 / 145 (7.6%) | 50 / 1,985 (2.5%) |

The quizmaster's own device and the three habitual non-answerers (Not Bret, Vel, Harprit) are
left out of "everyone else". Every one of her eight misses is a 10s round: WAM6 16 Sep, RRGM 6
Oct, SAJT 8 Oct, XFJX ×2 9 Oct, QY5X 13 Oct, VC8H 15 Oct, WD8S 20 Oct. **Question one loses two
to three times as many answers as any other question for everybody**; Cass is the sharp end.

**Her question-one answers land seconds behind her own clock, and on no other question.** For
each answer, `at − elapsedMs` is when the room's server says the clock behind that answer
started (plus write latency). Less the room's earliest on that question, it is that device's
lag:

| | n | median | p90 | max |
|---|---|---|---|---|
| Cass, Q1 | 29 | 0.1s | **4.7s** | **5.5s** |
| Cass, later questions | 479 | 0.0s | 0.1s | — |
| Anybody else, Q1 | — | ≤0.6s | ≤1.7s | 2.3s |

Her lagged Q1s: VVR8 5.5s, XDUF 4.7s, 77PC 4.6s and 4.7s, XRUE 2.5s, XX7B 4.7s and 2.4s, WD8S
2.1s, **79YX this morning 4.6s**. It comes and goes (0.0–0.4s in the rest) and sits near 4.7s
when it comes.

**The arithmetic.** The reveal folds what has landed at about window + 0.4s (the latest
counted Q1 landing on a 10s round is 10.4s, RRGM). With ~4.7s of lag, a 10s question one is
lost to any tap after ~5.5s on her clock. Two survivors were razor-thin: VVR8 landed at 10.0s,
77PC at 9.9s. On a 10s **Catchphrase** the options are held for half the clock, so her earliest
possible tap lands at ~9.7s — RRGM and XFJX's Catchphrase misses were nearly certain. On 15s
there is room for it, which is the 0 / 22.

So nothing broke on 6 October. The lag was there from 25 September (`at` is recorded from 22
September); what changed is 10s rounds and Catchphrase on question one.

## Most likely not refused — placeholder

`arrivalOk` in `firestore.rules` refuses an answer landing more than 8s after
`openedAt + elapsedMs`. Every lag measured is ≤5.5s, so these answers most likely **landed and
were too late for the fold**, rather than being refused. A refused one leaves no trace either,
so this is inference from the survivors, not a reading of the misses.

## "No message" — read in code, not tested

An answer that lands after the fold is kept on her own screen beside the published picks
(`useRoom.ts`, the `lastPicks` merge), so `verdictFor` returns `lost` and the line reads, in
amber, *Your answer didn't reach the room in time*. Two things can hide it: `.verdict` is
`opacity: 0` until the replay settles (`global.css`, `.verdict`), so a quick **Next** means it
never appears; and meanwhile the replay lands **her own chip on her own lectern**, which looks
exactly like a counted answer. "I got it right and just didn't get the points" is what that
screen shows.

## Not known: where the five seconds go

Two candidates, and they want different fixes:

1. **Her device sees question one late.** Question one is the one question the shared clock
   cannot correct ([`shared-clock.md`](shared-clock.md), point 4), so her countdown would start
   on her own late arrival. Fix: a skew estimate before question one.
2. **Her first answer write after the lobby is slow.** *Unverified, from memory of the SDK:*
   Firestore closes an idle write stream, so the first write after a quiet lobby reopens it,
   tokens and all, while later answers reuse it. Fix: wake the connection when the round starts,
   or let the fold wait for an answer the RTDB lamp says is in flight.

A pointer, not proof: seven of her seventeen lagged or missed rounds were a room's second round
that morning, where round one's clock samples should already correct (1) — unless the tab
reloaded in between, which a phone does. Only her device can say which.

## Options — Greg to decide

- **Now, free:** play 15s rounds. Zero of 22 lost. Changes the feel of the game.
- **To find the cause:** a question-one trace from **every** device, not Cass alone — Q1 costs
  everybody, and her uid (`ieDRJ5…`) is stable across 46 rounds, so a script filters to her.
  Needs a rules change, so it ships through CI on `master` — going live. **Live 21 Oct (#98)** —
  below.

## The trace — Greg, 21 Oct: "build it … don't go live"

> As the person running the quiz, I want every device to say what happened to it on question
> one, so that "I answered in time" can be checked rather than believed.

Acceptance criteria:

1. Every device in a round writes **at most one** trace, for question one, to
   `q1Traces/{gameId}_{uid}`. Nothing for later questions.
2. Written whether or not the player answered — a tap the client dropped says why (`phase`,
   `window`), and a write the rules refused carries its code.
3. It holds the two numbers that separate the candidates above: **how late this device saw
   question one, in server time** (`seenAfterOpenMs + serverOffsetMs`, the offset from the RTDB's
   `.info/serverTimeOffset`, which Firebase documents as *local + offset = server*, good for
   discrepancies over a second — read 21 Oct) and **how long its last answer write took to be
   acknowledged** (`ackMs`). Context: tap, reveal seen, counted, the clock correction applied,
   clock samples held before question one (0 = a fresh tab), how long the page had been
   visible, device class, network type.
4. Written once this device has seen the reveal and its answer write has settled. If either
   never comes, written when the room moves past question one, with what is known.
5. **It can never cost an answer.** Written over Firestore Lite, so a refusal cannot close the
   main SDK's write stream under the next answer (the beat's reason); failures are swallowed;
   nothing on screen.
6. No answer content: no option index, written after the reveal.
7. Rules: create only, as yourself, id `{gameId}_{uid}`, bounded shape, `at == request.time`; no
   read, no update; delete your own (so `check-rules` leaves no litter). Allow and deny cases in
   `e2e/` (emulator, CI) and in `check-rules` (live, after the merge).
8. `npm run read-traces [-- --name cass]` prints each with a reading: late delivery, slow write,
   both, or neither.
9. Cost: one write per player per round; no client reads.

**Where it lives:** `src/engine/q1Trace.ts` (the tracer, pure, 26 tests — including one that
fails if the rules' key list and the document drift), `src/lib/q1Trace.ts` (the Lite write),
`useRoom` (fed from the room listener and `submitAnswer`), the `q1Traces` block in
`firestore.rules`, `e2e/q1-trace.spec.ts`, four cases in `check-rules`, `scripts/read-traces.ts`.

**Verified before the PR, 21 Oct:** the e2e rules cases against the emulator — the allow case
fails on the old rules ("No matching allow statements") and passes on the new; eight denies, each
one change from that allowed write. The browser case plays a real question one: Ann taps and
files `writes 1, counted true` with every timing present (the emulator serves
`.info/serverTimeOffset`); the host, who never answered, files `writes 0, counted false`.
**Not covered until it is live:** the published ruleset (`check-rules` after the merge), a
real phone, and whether App Check passes the Lite write from every device.

**Live, 21 Oct (#98, gh-pages `18adffe`, 14:52 BST):** `check-rules` 123 PASS, 0 FAIL, the trace
allow among them. One real question one on the live site (room `XSQW`, a desktop browser, tab
closed before `finished` so no season row) filed `mac · 4g · seen late 0.5s · write 0.1s ·
counted → neither`. **Still not covered:** a phone, and Cass. The first office round is the check.

**After the go-live**, the next office rounds: `npm run read-traces -- --name cass`. What the
readings would mean:

| Reading on her lost Q1s | Means | The fix it points at |
|---|---|---|
| `late delivery` | Her device sees question one seconds late | A skew estimate before Q1 (`.info/serverTimeOffset` is already there) |
| `slow write` | On time, but the first answer write takes seconds | Wake the write path at round start, or hold the fold for a lit lamp |
| `neither`, `counted` | It did not happen that round | Keep reading |

A tab that reloaded or walked in mid-question also reads `late delivery`, honestly: it did see
the question late. `priorSamples 0` with a short `visibleForMs` is that case, not the network.

## How it was measured

`games/` ordered by `finishedAt`, 200 most recent, rounds of 3+ seats. Missing = a seated uid
with no entry in that question's `answers`; skipped questions left out. Lag = `at − elapsedMs`
less the minimum of the same over that question's answers. Window = `durationSecs`. About 500
document reads across the session's queries.
