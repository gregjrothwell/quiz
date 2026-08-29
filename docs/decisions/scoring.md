# Scoring

> **Owner: Greg Rothwell. Last updated: 29 August 2026. Budget: 250 lines.**

**Status: built 20 August 2026.** Decision recorded in
[`ideas-review.md`](ideas-review.md#1-rank-based-scoring--chosen) and the
[spine](../TOTAL-RECALL.md). The story and acceptance criteria are kept below as written,
because what a change was agreed to do is worth reading beside what it did.

**Deployed 20 August 2026** ([PR #6](https://github.com/gregjrothwell/quiz/pull/6)).
`check-rules` 36/36 before publishing — no rules changed, run on the standing principle that
the repo copy is not what Firebase is running — and the CDN was watched until it served
`index-BMejBzPG.js` rather than assumed.

**Proved with a full field on 29 August 2026** — `npm run rank-harness`. It had been the
oldest unproven claim in the project until then; see [Evidence](#evidence).

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

> ### Not "the ladder"
>
> That name is taken, and by something players can see. **The Ladder** is the `ramp` level in
> the lobby, which builds a round from easy to hard, and `Ladder.tsx` draws the round's
> progress beside the question. This file, the spine and several code comments called rank
> scoring a ladder throughout until **Greg caught it on 20 August 2026** — two unrelated
> mechanics under one name, one of them on screen in front of the office.
>
> The mechanic is the **rank bonus**; the scheme is **rank scoring**. Corrected in place
> rather than quietly, because the collision is the sort of thing that gets reintroduced by
> whoever next writes about scoring without knowing the lobby's level names.

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

## Two decisions, both taken

- **`durationMs` is gone from `tallyQuestion`.** The bonus does not need the window, and
  late answers are already refused twice before scoring — `submitAnswer` (`useRoom.ts:644`)
  and the reducer's own guard. An argument nothing reads is the kind of thing that later
  gets read.
- **The floor stays at 100.** A slow correct answer is worth 600 against a fast one's 1000 —
  a 40% spread where the old curve gave 25%. That is the intended sharpening. If it proves
  brutal in a big room, **the floor is the dial, not the steps above it**.

## Two things the story did not foresee

Both found while building, both left as they are, both worth knowing before somebody reports
them as bugs.

- **A mid-question join is now a softer penalty than it was.** Somebody who walks in on an
  open question submits `elapsedMs = durationMs` (`App.tsx:350`), because their own clock
  started when they sat down and says nothing about how fast they were. Under the old curve
  that stripped the speed bonus exactly, leaving the base. Under rank scoring it sorts them
  **last among the correct answers** — so in a room where two people got it right, they are
  second and take 900 rather than 500. Making it exact would need the answer document to say
  *"I walked in"*, which is a new field and a rules paste for a case worth 100 points.
- **The podium's elapsed chip shows one decimal, and points no longer follow it
  continuously.** Two players a millisecond apart can read `1.2s` and `1.2s` and be 100
  points apart, where under the decay curve they were a point apart and nobody could tell.
  `PodiumTile.tsx` records it. **Left alone deliberately** — whether that chip should show
  the time or the position is a question about the podium, not about scoring, and quietly
  adding a second decimal would answer it without anybody deciding.

## What this makes worse, and it is deliberate

**It raises the value of a faked `elapsedMs` from about 5 points to 100.** `elapsedMs` is
measured on the answering device and the rules bound it only for sanity
(`firestore.rules:291`). Nothing here closes that, and the honest read is that rank scoring
makes the existing hole worth exploiting for the first time.

The companion change is costed in
[`ideas-review.md`](ideas-review.md#5-bound-elapsedms-server-side): a server-provable lower
bound, `elapsedMs >= (request.time - openedAt) - grace`, for one rule `get()` per answer
write. **Not part of this story**, but it should not stay unbuilt for long afterwards.

## The tests, written first

Nine cases in `src/engine/scoring.test.ts`, written and watched fail — **9 failed, 21
passed** — before `scoring.ts` was touched:

- One correct answer alone scores 1000.
- Four correct answers in a known `elapsedMs` order score 1000 / 900 / 800 / 700.
- A sixth correct answer scores 600, and so does a seventh.
- A wrong answer scores 0 **and is present in the result**.
- A question nobody got right yields all zeros, with every answerer present.
- Two players on identical `elapsedMs` both take the higher bonus and the next resumes at the
  count awarded.
- A question nobody answered yields `{}`.
- `verdictFor` still returns `wrong` — not `lost` — for a scored wrong answer.

`fullGame.test.ts` needed no change at all: its rounds are answered by one player at a time,
and a lone correct answer was worth 1,000 under both schemes.

**Two tests in `reducer.test.ts` did move, and one of them is worth keeping an eye on.**
*"scores speed against the room's window rather than the default"* asserted 750 on a
ten-second window against 875 on a twenty-second one. That behaviour is exactly what this
change removes, so the assertion was **inverted rather than deleted** — both windows now pay
1,000, and the test says so along with what it used to say. Deleting it would have removed
the only coverage of the window's effect on a score in the same commit that changed it.

## Evidence

**Done:** `npm run typecheck`, `npm run lint` and `npm run build` clean; **416 tests
passing**, up from 412. No `any`, no `@ts-ignore`. The main chunk went 224.72 kB → 225.54 kB.

The `#/preview` gallery renders the bonuses in a real screen — `1,000 / 900 / 800 / 700` down
the standings — with no console errors and no sideways scroll at 1280px. Its fixtures were
hand-written deltas from the old curve (`+880`, `+640`, `555`, `795`, `955`), which rank
scoring cannot produce; they are now legal values, because a design gallery showing scores the
engine cannot generate is a lie in the one place that exists to show what the app looks like.

### The full field — 29 August 2026

**Proved.** `npm run rank-harness` puts the entire ladder in one live question, in room
`9RFD` and again in `MJ8T`:

| Seat | lectern | elapsed | expected | paid | proves |
|---|---|---|---|---|---|
| Ada | correct | 1,200ms | 1000 | **1000** | first takes the top bonus |
| Bo | correct | 2,400ms | 900 | **900** | second takes 400 |
| Cyd | **wrong** | 3,000ms | 0 | **0** | a wrong answer scores nothing and is *still in the tally* |
| Dev | correct | 3,600ms | 800 | **800** | third takes 300 |
| Eli | correct | 4,800ms | 700 | **700** | fourth takes 200 |
| Fay | correct | 4,800ms | 700 | **700** | a tie shares the rank rather than splitting it |
| Gus | correct | 7,500ms | 600 | **600** | the next distinct time resumes at *sixth*, so the floor |

Every acceptance criterion above is in that one table except #4, #5 and #7, which no round
needed to show. **The host answered nothing and is absent from the deltas rather than zero in
them** — criterion 2, and the distinction `verdictFor` reads to tell `wrong` from `lost`.

Four things about the instrument, because the numbers are only worth what it is worth:

- **The expectations are written by hand from the table at the top of this file**, not
  computed by `tallyQuestion`. Deriving them from the function under test would only ever
  prove the engine agrees with itself.
- **Everything is read back with `getDocFromServer`.** The ordinary `getDoc` would have been
  served from a cache holding this process's own writes, and could have confirmed the whole
  run without a byte surviving the trip.
- **A second client re-derives the deltas** from the answers as *it* reads them off the
  server — `liveAnswers` then `tallyQuestion`, the two functions the browsers use. That is
  criterion 6, and no single device can show it.
- **It never needed a second person.** It needed a second client. `elapsedMs` is stated by
  the answering device, which this file calls the scheme's one real weakness — and it is
  exactly what makes a deterministic order possible. The vault seeds `hq0` as
  `'The first one'`, so the harness knows the right lectern without reading a vault it is
  not allowed to read.

**And on screen.** `npm run rank-harness -- --browser` waits for a real browser, on the live
site, over reCAPTCHA attestation rather than a debug token. It answered correctly at
18,076ms — after every seat, so seventh, so the floor — and the player's reveal read
`CORRECT · +600` against the terminal's `Browser … was paid 600`. The two agreeing is the
point, as it was for the shared clock.

That run used a **thirty-second** window and paid every seat exactly what the ten-second run
paid. Window-independence was a claim in this file (`scoring.ts:44`) and is now a
measurement.

Two things the run caught, both by cross-check rather than by the report:

- **The harness reproduced the bug `host-room` had carried for weeks** — it folded its first
  reveal without reading the answers subcollection and paid the room nothing. It caught
  itself: the second client re-derived the full ladder while the room's own `lastDeltas` came
  back `{}`. Two readings that cannot both be true.
- **`+574` on the player's screen**, which is not a number this scheme can pay. It was a tween
  frame counting up to 600, and the second screenshot settled it. One reading would have been
  a confident wrong bug report.

**Still outstanding:** the final screen's fastest-finger rosette, which needs a round played
to `finished` — this one stops at the reveal.

**No rules change, so `check-rules` is unaffected** — but run it before deploying anyway, on
the standing principle that the repo copy is not what Firebase is running.

## One thing this makes more urgent

[`clock.md`](clock.md) and `README.md` both justified the locally-measured answer clock with
*"office laptops disagree about the time by more than the speed bonus is worth"*. The
decision is unchanged and still right — comparing wall clocks would be worse — but **the
stakes went up**: the gap between first and second is now 100 points rather than a handful,
so a device running five seconds behind loses more than it used to. The README wording is
corrected, and this is another reason the shared clock is the first thing in
[`ideas-review.md`](ideas-review.md#the-shared-clock--it-takes-answers-off-people).
