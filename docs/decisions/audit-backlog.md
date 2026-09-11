# The audit backlog — what was found, what was fixed, what is left

> **Owner: Greg Rothwell. Last updated: 8 September 2026. Budget: 250 lines.**

A full security, optimisation and recent-changes audit ran on 8 September 2026,
read off the live Firebase project and the deployed artefact rather than the
documents. This is the half that was **not** built, written so the next session —
Cursor, or a fresh one — can pick any item up without re-deriving it.

**Written to be self-contained.** Cursor gets `AGENTS.md` and
`~/clawd/context/standards/`; it does **not** get `CLAUDE.md`, so the
conventions it needs are repeated at the bottom.

## State when this was written

- **Live:** `index-BHU2ry6N`, deployed 8 September. The App Check debug token is
  out of the bundle and the old `index-BDZpMBAG` returns **404**.
- **The token is revoked and reminted.** `npm run check-rules` — **64/64, 0
  failures** — against the live project, which is the *allow* direction and is
  what proves the new token works.
- **[PR #35](https://github.com/gregjrothwell/quiz/pull/35) is open and not
  merged**, so `master` is behind what is live. Merging it is one click.
- **736 tests**, typecheck and lint clean.
- **`check-rules` is 64 checks, not 65.** The docs said 65/65 for weeks; that
  hand-count included the `label: string` line of the `Check` interface at
  `scripts/check-rules.ts:257`. Dated entries still say 65 and are left alone —
  this is the correction, not a rewrite.

## Ranked, with the failure each one causes

### 1. The steal robs players who have left the room — HIGH

`src/engine/scoring.ts:137` — `stealFor` calls `standings(scores)[0]`, the **raw**
map. `src/engine/reducer.ts:321` passes membership-filtered `answers` but
unfiltered `scores`.

`roomStandings()` (`scoring.ts:337`) exists precisely to drop non-members, and
its own docstring says *"ranking the raw map puts people on the board who are not
in the room."* It names three call sites. `stealFor` is not one of them.

**Failure:** the leader closes her tab. `leave()` deletes `players.ann` but keeps
`scores.ann`. The next correct answer steals 5% from a player who is not there —
the screen reads *"You took 520 off the leader"* with no visible victim, and
`deltas.ann` rides into the permanent `games/` record for a uid absent from
`record.players`.

Steal is opt-in and **has never been played**, so it has not bitten. 21 tests in
`src/engine/steal.test.ts` and none puts a departed player top.

### 2. Unbounded document creation — HIGH (security)

`firestore.rules`. `games/`, `seasons/{s}/asked/{packId}`, `questionVotes/` and
`recovery/` all take a **client-chosen path segment**, so an anonymous client can
mint unlimited documents. `gameOk()` bounds the top level only —
`questions is list` with `size() <= 50` and unchecked elements. `asked.ids` has
no per-element size bound. Against a 20k-writes/day free tier, and nothing sweeps
`games/`: `read` and `list` are both denied, so only the Admin SDK can see it.

`seasons/{s}/asked/{packId}` also allows `delete: if signedIn()` — anyone can
wipe a pack's repeat-avoidance history.

**App Check was the only thing throttling this, and it was bypassable until
8 September** ([`debug-token-leak.md`](debug-token-leak.md)). Needs a ruleset paste.

### 3. `ownEntryOk()` bounds only the writer's own entry — MEDIUM (security)

`firestore.rules:171`. `wellFormed()` caps `players`/`scores` at 60 keys but
**never type-checks a `scores` value**. A member can write 59 neighbour entries,
or one ~900 kB score, into the document every client re-reads on every phase
transition. That a member may write another's entry is documented; the **size**
consequence contradicts `firestore.rules:120-123`. `check-rules` has no case on
the `players` map — the one place cross-player writes are legal is the one place
with no bound asserted.

### 4. Nothing memoises, and the clock re-renders the tree at 10 Hz — HIGH (perf)

`src/lib/useQuestionClock.ts:79` calls `setReading({...})` with a **fresh object**
every 100ms, and the hook sits at the top of the room UI (`src/App.tsx:235`).
A 20-second window × 10 Hz × 15 questions is **~3,000 full-tree renders a game**,
each reconciling the Ladder, every lamp — including an `Object.entries().sort()`
per tick at `src/components/AnswerLamps.tsx:28` — and four podium tiles, to move
one SVG `stroke-dashoffset`.

`grep -rn "memo("` across `src/components` and `src/screens` returns **nothing**.
This is the answer to "will a ten-player office laptop cope".

**Do the cheap half first:** `memo()` on `Ladder` and `AnswerLamps`, whose props
change once a question rather than 200 times.

### 5. `motion` is preloaded at first paint for the scoreboard — HIGH (perf, cheapest)

`dist/index.html` carries `<link rel="modulepreload" href=".../motion-*.js">` —
**39.61 kB gzip, 14.8% of initial JS**. It is pinned there by `MotionConfig` at
the root (`src/main.tsx:18`) when the only real user is
`src/components/Standings.tsx`, which nobody sees until the scoreboard.

**Move `MotionConfig` into `Standings` and lazy-load it.** No behaviour change.
This is the best ratio of win to risk in the whole audit.

### 6. The keydown listener is rebuilt ten times a second — MEDIUM (perf)

`src/App.tsx:519` — `handleAnswer` has `clock.elapsedMs` in its dependency array,
so its identity changes every tick and the effect at
`src/screens/QuestionScreen.tsx:350` re-subscribes the window listener ~3,000
times a game. It also blocks any future `memo()` on `QuestionScreen`. Fix is a
ref for `elapsedMs` so the callback identity is stable.

### 7. A third leak nobody had named — MEDIUM (cost)

`src/lib/questionVotes.ts:63` writes one document per player per question —
**~90 a six-player game**, 90× the rate rooms accumulate. `scripts/fold-votes.ts`
reads and folds them and **never deletes**; `scripts/prune-rooms.ts` does not
mention them.

And `scripts/take-stock.ts:173` counts neither `questionVotes` nor `games` — the
two fastest-growing collections are the two the stock-taking tool cannot see,
while `cost.md` frames it as what says a prune is due. Two lines in the
`Promise.all`.

### 8. Smaller, all confirmed

| | |
|---|---|
| `src/lib/useGameLog.ts:148` freezes a question on the first `reveal` render, so an answer arriving on the other listener a moment later is missing from the kept record for good. `QuestionScreen.tsx:186` guards this exact hazard and documents it; this does not. |
| `src/lib/useRoom.ts:843` — the double-tap dedupe reads `room.answers[uid]`, which only populates after the round-trip, so it never fires for the case it names. A phone double-tap writes a `firstMs` and gets marked. |
| `src/lib/useRoom.ts` has **no tests at all**, and `firstTouch.test.ts` re-implements its `Math.min` rather than calling it. |
| `src/App.tsx:786` — the `games/` retry guard closes over no game id, so a late `'failed'` from one game clears the next one's guard. Costs one refused write. |
| A round finished offline hangs rather than resolving `'failed'`, so the documented retry never fires. |
| `scripts/game-report.ts:145` sums `snaps` over all questions while `hitRate` uses `played`, under a header saying skipped questions are left out. |
| `src/lib/useRoom.ts:448` is the only `onSnapshot` with no error callback — refused, answers stop silently. |
| `src/lib/identity.ts:64` — `hasClaimedIdentity` is dead, zero call sites. |
| `docs/decisions/known-limits.md` bundle figures are stale: "262 kB across two chunks" is now **276 kB across four**. |
| 33 of 49 published stills still breach `MAX_STILL_BYTES`. The generator is fixed; regenerating needs `npm run write-hand-packs`, which re-downloads from Commons and the Met. Question ids are slug-based so **no vault re-seed**. |

### 9. Two the office would feel, from the live data

- **The average board punishes turning up.** Live season-2: **Vel played 1 round
  and ranks 4th on average**; Not Bret played 28 and drops ten places. That is
  `ideas-review.md` §9, sharper than when it was written.
- **The season table is split across duplicate identities** — 26 rows for roughly
  ten humans. *Greg* appears twice, so do *Steve* and *Joe*; *cass* and *Cass* are
  separate rows. **0 recovery codes, 0 identity claims**, because nothing has ever
  asked anybody to save one (`ideas-review.md` §8). It is not an unused feature;
  it is corrupting the table the season is scored on.

## Testing — the assessment Greg asked for

**Vitest is right, keep it.** 736 tests in ~700ms, `environment: 'node'`, offline.

**But `vite.config.ts:58` is `include: ['src/**/*.test.ts', ...]` — `.tsx` is not
matched**, so a component test written today would silently never run. There are
zero `.test.tsx` files and no `jsdom`, `@testing-library` or `react-dom/server`.
Every bug in §4, §6 and §8 above lives in that untested wiring.

**Playwright: not yet.** The multi-client concerns are already covered better by
the Node harnesses (`sync-harness`, `rank-harness`, `check-rules`, `host-room`),
which drive the real client SDK against the live project. What Playwright would
uniquely buy is the browser: pressing the replay button, audio unlock, the
picture render, real `Tab` focus. What it costs: **there is no CI** — no
`.github/workflows` at all — so it would be run by hand, and it needs Firebase,
which means an E2E runner wanting an App Check debug token in its environment.
**That is exactly how [`debug-token-leak.md`](debug-token-leak.md) happens again.**

**Order:** widen the glob, add component tests under Vitest, and give Playwright
the emulator — not a debug token — if it ever arrives.

**Correction, 10 September 2026.** The glob was already widened. Component tests
now run in a Vitest `dom` project (`jsdom`; Chair and RoomLink). Playwright is
in CI against the emulator — [`emulators.md`](emulators.md). The two blockers
above are what was true on the 8th: CI exists, and e2e does not get a debug
token. The paragraph is left standing so the original assessment stays readable.

## Conventions, because Cursor does not get `CLAUDE.md`

- **Branch, never commit to `master`.** Never push without Greg saying so in
  words. Never rewrite history — no `--amend`, no rebase, no force.
- **No `any`, no `@ts-ignore`, no `@ts-expect-error`.**
- **A bugfix fixes minimally.** Never refactor while fixing.
- **Nothing in `scripts/` may import `src/firebase.ts`** at any depth — it reads
  `import.meta.env`, which Node does not define, and the script dies before its
  own code runs. `scripts/imports.test.ts` fails if it comes back.
- **Rules are pasted by hand.** The repo copy is not what Firebase is running,
  and `npm run check-rules` is the only thing that knows. **Paste before deploy.**
- **Published packs are sealed** — no file in `public/packs/` may contain an
  answer. `src/questions/seal.test.ts` enforces it both ways.
- **Quizmaster is derived** (`resolveQuizmaster`), never stored. A phase
  transition never writes the whole `players` map.
- **Doc budgets, enforced by a session hook:** `HANDOVER.md` 150,
  `TOTAL-RECALL.md` 300, each file in `decisions/` 250, `AGENTS.md` 80. **Over
  budget means split, not tidy.**
- **Append; do not rewrite.** A correction is a new dated note saying what
  changed, with the wrong claim left visible.

## Verify

`npm run typecheck && npm run lint && npm test`, then `npm run check-rules`
(**64/64**) after any paste, and `npm run sync-harness 10` for anything touching
timing or the end of a round.

**Force every new guard red before believing it.** Two were caught this way on
8 September: an assertion that passed on the broken source because the type
annotation satisfied it, and a link/count check that reported OK while failing to
read any file at all. **A checker that cannot fail is not a checker.**

**Cross-check the instrument.** When a grep comes back empty, run it for
something you know is there. That is what caught the CDN serving a stale bundle
during the 8 September deploy.
