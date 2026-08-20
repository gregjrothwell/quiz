# Scoring

> **Owner: Greg Rothwell. Last updated: 20 August 2026. Budget: 250 lines.**

**Status: story agreed, not built.** Decision recorded in
[`ideas-review.md`](ideas-review.md#1-rank-based-scoring--chosen) and the
[spine](../TOTAL-RECALL.md). This file is the agreement; it becomes the subsystem doc when
the work lands.

## The story

> As a player, I want the points to reward **being first**, so that answering quickly is
> worth something the room can feel — rather than a difference of fifty points that nobody
> has ever noticed.

## Why the current curve fails

`scoreAnswer` is `BASE_POINTS` 500 plus up to `SPEED_POINTS` 500, decaying linearly across
the window (`src/engine/scoring.ts:21`). Against this project's own measurements — human
reaction plus render plus network at roughly 300–400ms — on a ten-second window:

| Answered at | Scores |
|---|---|
| 0.4s (as fast as anyone can) | 980 |
| 1s | 950 |
| 2s | 900 |
| 5s | 750 |

**Anybody who simply knows the answer scores 950–980.** One second against two is fifty
points in a thousand. Nobody has ever scored 1,000 and nobody ever will, because the theoretical
maximum needs a zero-latency answer at the instant of render.

The curve came from Polly and has never been questioned. Questioning it is step 1.

## The shape

**500 for a correct answer, plus a rank bonus by the order the correct answers landed:**

| Position among correct answers | Bonus | Total |
|---|---|---|
| 1st | 500 | 1000 |
| 2nd | 400 | 900 |
| 3rd | 300 | 800 |
| 4th | 200 | 700 |
| 5th and after | 100 | 600 |
| Wrong | — | **0** |

Order is decided by `elapsedMs` among the correct answers only. Being fourth-fastest overall
but first of the people who got it right is first.

## Acceptance criteria

1. A correct answer scores 500 plus its rank bonus; a wrong answer scores **0**.
2. **`tallyQuestion` still emits an entry for everyone whose answer was scored**, including a
   zero for each wrong one. This is not cosmetic: `verdictFor` distinguishes `lost` from
   `wrong` by the presence of a key (`scoring.ts:100`, [`late-answers.md`](late-answers.md)),
   and a missing zero would make an honest wrong answer read as a lost one.
3. **Ties share a rank and the next distinct time resumes at the count already awarded** —
   the exact convention `standings()` uses (`scoring.ts:118`). Two players tied on the
   fastest correct answer both score 1000 and the next scores 800.
4. The maximum for one question stays **1,000**, so `maxBest()` and `best <= points` in
   `firestore.rules:419` are untouched and **no ruleset paste is needed**.
5. Only room members score. The `eligible` filter in `reducer.ts:239` is unchanged.
6. Every device computes identical deltas from the same reveal — the reveal is folded once
   and broadcast, but `useGameLog` and the awards re-derive from it on every client, so the
   arithmetic must be a pure function of `{correctIndex, answers}`.
7. `awardsFor` is unaffected. **Checked, not assumed:** `fastest` in `awards.ts:50` measures
   the single quickest correct answer *of the night* by `elapsedMs`, which is a different
   claim from the per-question rank bonus and stays true alongside it. The two agree in the
   common case, because rank is decided on `elapsedMs` too.

## Two decisions for Greg

- **`durationMs` becomes unused in `tallyQuestion`.** The rank formula does not need the
  window, and late answers are already refused twice before scoring — `submitAnswer`
  (`useRoom.ts:644`) and the reducer's own guard. Keep the parameter as documentation of what
  bounds an answer, or drop it and let the two guards own that entirely? **Recommend
  dropping it**: an argument nothing reads is the kind of thing that later gets read.
- **The floor.** 100 for fifth and after means a slow correct answer is still worth 600
  against a fast one's 1000 — a 40% spread, where today it is 25%. That is the intended
  sharpening. If it proves brutal in a big room, the floor is the dial, not the ladder.

## What this makes worse, and it is deliberate

**It raises the value of a faked `elapsedMs` from about 5 points to 100.** `elapsedMs` is
measured on the answering device and the rules bound it only for sanity
(`firestore.rules:291`). Nothing here closes that, and the honest read is that rank scoring
makes the existing hole worth exploiting for the first time.

The companion change is costed in
[`ideas-review.md`](ideas-review.md#5-bound-elapsedms-server-side): a server-provable lower
bound, `elapsedMs >= (request.time - openedAt) - grace`, for one rule `get()` per answer
write. **Not part of this story**, but it should not stay unbuilt for long afterwards.

## Tests to write first

In `src/engine/scoring.test.ts`, before any change to `scoring.ts`:

- One correct answer alone scores 1000.
- Four correct answers in a known `elapsedMs` order score 1000 / 900 / 800 / 700.
- A sixth correct answer scores 600, and so does a seventh.
- A wrong answer scores 0 **and is present in the result**.
- A question nobody got right yields all zeros, with every answerer present.
- Two players on identical `elapsedMs` both take the higher bonus and the next resumes at the
  count awarded.
- A question nobody answered yields `{}`.
- `verdictFor` still returns `wrong` — not `lost` — for a scored wrong answer.

Then `fullGame.test.ts`, which already plays complete rounds, will move: its expected totals
are the regression surface, and updating them is where a mistake in the ladder shows up.

## Evidence

`npm run typecheck && npm run lint && npm test` clean, no `any`, no `@ts-ignore`.

Then a live round, because two things have to agree on one screen: the scoreboard's rank
bonuses and the final screen's fastest-finger rosette. A solo round cannot show it — ranks
need at least two people who answered — so this needs `npm run host-room -- 15` with a
browser alongside, which is the same evening the review panel and squad-vs-squad are waiting
on.

**No rules change, so `check-rules` is unaffected** — but run it anyway before deploying, on
the standing principle that the repo copy is not what Firebase is running.
