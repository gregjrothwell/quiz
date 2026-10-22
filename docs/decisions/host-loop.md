# hostLoop — story and acceptance criteria

> **Owner: Greg Rothwell. Last updated: 22 October 2026. Budget: 250 lines.**

**Status: APPROVED 22 October 2026, all three steps.** Greg: *"Approve the host
clean-up as recommended: all three steps including the test scripts and the CI
whole-round test; saving scores stays on each player's phone. Start step 1."* Item 5 of the sequence in
[`direction-oct-2026.md`](direction-oct-2026.md#2-architecture), weakness 1:
*"The de facto server is two untested React files."* Every claim about the
code below was read on `74fd345`, 22 October 2026.

## The problem, in the code

Since W3 one device — the host — runs the round for everybody. What it does
is spread over three React files, and none of it has a test:

| Duty | Where it lives today |
|---|---|
| Apply an action: reduce the room, write the diff | `dispatch`, `useRoom.ts` (~line 630) |
| Reveal when the clock runs out: ask the vault, retry with backoff | effect + `handleReveal`, `App.tsx` (~689, ~825) |
| Beat every 15 s so nobody claims the chair | effect, `useRoom.ts` (~1088) |
| Reap players gone from presence, in the lobby | effect, `useRoom.ts` (~1058) |
| Share or Shaft: end the talk, close picks, settle | effects, `useStandoff.ts` (~232–280) |
| Remember which questions a pack served | `recordAsked` at start, `App.tsx` (~466, ~529) |
| Keep the round in `games/` | effect, `App.tsx` (~969) |

`useRoom.ts` and `App.tsx` are 1,177 and 1,176 lines. `useRoom.ts` has no test
file (audit backlog, item 8).

**The harnesses test a copy, not the host.** `scripts/hostBeat.ts` describes
itself as the beat "as `useRoom` writes it"; `host-room`, `final-harness` and
`rank-harness` drive rounds with their own start / reveal / next / settle. When
they pass, what is proved is that the copy works. Today's bank failure is the
same shape: every check proved something next to the real path.

Checked 22 October: `host-room`, `final-harness` and `rank-harness` each call
the reducer and write start / reveal / next (and the final's moves) themselves —
6, 10 and 6 sites — and each beats through `hostBeat.ts`.

**It is also the W4 blocker**, per the direction review's architecture section.

## Cut to essentials

- **No new behaviour.** Not one write changes: same documents, same fields,
  same order, same timings. This is a move, and the proof is that nothing
  moved but the code.
- **Not the member side.** Joining, answering, banking, the claim and the
  rejoin stay where they are. Only what the host does *for the room*.
- **Not a server.** It still runs in the host's browser. Running it elsewhere
  is W4's decision, made easier by this, not taken by it.
- **Not one PR.** Three, each shippable alone (see *Order*).

## The story

> **As Greg**, I want everything the host's device does for the room to live in
> one plain TypeScript module, driven by the app and by the harnesses alike,
> **so that** a test of the host is a test of the real host, and the next bug in
> running a round is caught before the office finds it.

## Acceptance criteria

### A. The module

- **A1.** `src/host/` holds the host's duties from the table above, with no
  React import. `scripts/imports.test.ts` gains a check that nothing under
  `src/host/` imports `react`.
- **A2.** It never imports `src/firebase.ts`. Firestore, the RTDB, the vault
  and the clock come in as arguments ("ports"), so a Node script can run it —
  the same rule `scripts/` already lives under.
- **A3.** The decision of *what is due now* is pure: given the room, the
  answers, presence, the beat and the time, it returns the next move (or
  nothing). Unit tests cover each move and each "not yet": reveal before the
  clock, a second reveal while one is in flight, settle before every pick opens,
  reap outside the lobby.
- **A4.** Performing a move goes through the ports, and failures are returned
  to the caller, never swallowed. The app keeps showing them as it does now.

### B. The app uses it

- **B1.** `useRoom`, `App` and `useStandoff` call the module for every host
  duty in the table; the effects that did the work become thin wrappers.
- **B2.** **Same writes.** A recorded round — one hosted room, three players,
  every phase including a Share or Shaft final — produces the same sequence of
  room writes (fields and values, ignoring timestamps) before and after. The
  recording is an emulator test kept in `e2e/`.
- **B3.** `npm run e2e`, `rank-harness`, `sync-harness 10` and `host-room` all
  pass against the new build, and one real browser round is played to the
  podium on the dev build before the PR is called done.
- **B4.** `useRoom.ts` and `App.tsx` each lose at least 250 lines. (A number,
  so "extracted" means something.)

### C. The harnesses use it

- **C1.** `host-room`, `final-harness` and `rank-harness` drive their rounds
  through `src/host/`, and `scripts/hostBeat.ts` is deleted.
- **C2.** A new emulator test runs a whole round with the module in Node and
  three scripted players, with no browser: start, every reveal, the final,
  `games/` kept. It runs in `npm run e2e` in about a minute, so CI proves the
  real host on every PR.

## Order of build

1. **A** with its unit tests, plus the B2 recording taken on today's code.
   Nothing is wired in; players see nothing.
2. **B**: wire the app in. B2's recording must match.
3. **C**: the harnesses switch over and the Node round test (C2) is added.

Each step is its own PR with `What's new: none — <why>`. Step 2 is the risky
one: it changes the code that runs every round.

## Step 1 — built 22 October 2026, branch `host-loop-1`

`src/host/`: `due.ts` (what is due, pure; memory is a value), `moves.ts` (doing
it through ports; failures reject), `prepare.ts` (dealing a round and
`recordAsked`), `ports.ts`. Not imported by the app. `imports.test.ts` fails if
anything under it reaches `src/firebase.ts`, or React at runtime — proved by
adding each import and watching it fail. B2's recording:
`e2e/host-writes.spec.ts` and `host-writes.golden.json`, taken on this code.

**Three places the old code did something nobody chose, found reading it.**
Step 2 must pick each on purpose, not by accident:

1. *A room update during a reveal's backoff retries at once.* The retry timer
   lives in an effect that re-runs on every room change, and its cleanup cancels
   the timer, so the next render retries immediately without spending one of the
   eight. `due.ts` waits out the backoff. Only reachable when the vault refuses.
2. *After the eighth refusal, any room update tries once more.* Same cause. The
   cap only stops the timer. `due.ts` stops, and leaves the Reveal button.
3. *A second game in the same tab loses question one's gate time.* The expiry
   effect stamps it into the last game's map, which `handleReveal` then empties.
   `due.ts` changes map first. It only affects `gateMs` in `games/`.

The reaper is still run on each presence reading, not on a timer, as today.

## Step 2 — built 22 October 2026, branch `host-loop-2`

`src/lib/useHost.ts` runs `src/host/` in the browser: it asks `dueNow` when
anything it reads changes and when a wake comes round, performs the moves, and
reports how each went. `App.tsx` lost the reveal, its retry ladder and timings,
the `games/` keep and the three deal functions; `useRoom.ts` the reaper and the
beat; `useStandoff.ts` its three moves, keeping the picks and the clocks.

**B4 missed for `useRoom.ts`, on measurement.** `App.tsx` 1,235 → 859 (−376).
`useRoom.ts` 1,193 → 1,131 (−62): it only ever held three host duties. The rest
is the member side — joining, answering, the claim, presence — which the story
cut out. Reaching −250 would mean moving that, so the number was wrong, not the
work. (−250 was this file's own guess, made before counting.)

**The three accidental behaviours (step 1) now do the deliberate thing**: the
backoff is waited out, eight timed retries is the end (the Reveal button
stays), and question one keeps its gate time. One visible difference: the room
stopped saying "Revealing…" as the ninth attempt *started*; it now stops when it
*fails*. All four only occur when the vault refuses.

## Step 3 — built 22 October 2026, branch `host-loop-3`

`scripts/nodeHost.ts` runs `src/host/` from Node: it listens as `useRoom` does
and writes through the app's own `toUpdate`. `host-room`, `final-harness` and
`rank-harness` press only Start and Next; the host beats, reveals, moves the
final on and keeps the round. `sync-harness` and `reveal-gate-probe` use it
for the beat alone (the probe must reveal by hand to measure the gate).
`hostBeat.ts` is gone, and so are three hand-rolled `toUpdate`s. The game log's
rule moved to `src/host/gameLog.ts`, shared by `useGameLog` and Node.
`e2e/node-round.spec.ts` (C2): a 3-question round and a final, no browser, ~2 min.

**Found on the way.**
- *A Lite instance made from an emulator-pointed app is not on the emulator.*
  The first C2 run sent 48 beat and vault writes to the live project's
  endpoint with a dummy key; live refused every one, nothing landed.
  `startNodeHost` now takes `lite` from its caller; `nodeClient` hands one
  pointed at the emulator. The second run sent none.
- *The emulator refuses some vault candidates with "Transaction lock timeout".*
  The retry ladder recovers them (3, 2, 3 attempts in one run); C2 allows
  those and fails on anything else.

**Changed for whoever runs them.** `final-harness` now waits out the real
60 s talk, and the host settles 5 s after the whistle whether or not the second
finalist has opened. The harnesses that reach `finished` now write `games/`,
as the app does. **None was run against the live project for this change.**

## Risks

- **Hidden ordering.** Some effects depend on React render order — e.g. the
  reveal effect waits on `answersReady` and a retry counter. Moving them can
  change *when* a write happens without changing *what*. B2 compares the
  sequence; B3 plays real rounds.
- **Size.** About three sessions. Step 2 should not share a release with
  anything else.

## Decided — Greg, 22 October 2026

| Decision | Outcome |
|---|---|
| Story, cut and three-step order | Approved as drafted |
| `recordGame` | Stays with the member side: each device banks its own row. Moving it would change behaviour, and season rows are owner-only, so the host could not write them without a rules change |
| C (harnesses) | Now, as step 3 — it is the step that makes CI test the real host |
