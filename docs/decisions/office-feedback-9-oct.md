# Office feedback — 9 October 2026

> **Owner: Greg Rothwell. Last updated: 9 October 2026. Budget: 250 lines.**

Two rounds in `XFJX` this morning (Name that Tune 20 Qs, then Catchphrase 10 Qs, 5 seats,
10s), on the day of the 30-player game. Read with `read-games` and a one-off Admin script over
`games/` — **33 reads in all**, verified from the queries (`limit(3)`, two `doc().get()`,
`limit(30)`).

## 1. "Cass didn't get points banked when she was definitely in time"

**Verified:** in both `XFJX` rounds Cass (`ieDRJ5…`) has **no answer recorded on question 1**,
and answers on every later question but one. Across the last 30 kept rounds:

| Room | Date | Pack | Cass missing Q1? |
|---|---|---|---|
| `XFJX` | 9 Oct | Catchphrase | **yes** |
| `XFJX` | 9 Oct | Name that Tune | **yes** |
| `SAJT` | 8 Oct | Catchphrase | no |
| `SAJT` | 8 Oct | The Price Was Right | **yes** |
| `XX7B` | 8 Oct | both | no |
| `XRUE` | 7 Oct | both | no |
| `RRGM` | 6 Oct | Catchphrase | **yes** (already noted in TOTAL-RECALL, 6 Oct) |
| 10 rounds | 24 Sep – 5 Oct | — | never |

**4 of her 10 rounds since 6 October, every one on question 1; none in the 10 before.** Later questions she
misses 3 times in 20 rounds. Q1 is also the question everybody else loses most often (Roberto,
Steve, Not Bret, Joe, Kelly, Vel, Greg — 1–2 a round), so Cass is the sharpest case of a
general first-question loss, not a problem only she has.

**What "no answer recorded" means:** a kept answer is one player's response "as the reveal scored it"
(`RecordedAnswer`, `src/engine/gameRecord.ts`). So her Q1 write either never landed, was
refused, or landed after the reveal. The room's answer docs are overwritten each question, so
nothing left in Firestore can say which.

**Leading hypothesis — placeholder, not verified:** question 1 is the one question the shared
clock does not correct ([`shared-clock.md`](shared-clock.md), point 4: one sample has nothing
to compare against). A device that receives Q1 late counts a full ten seconds from its own
arrival; from Q2 the correction takes that lag back off. If Cass's device is a second or two
behind, her countdown says she is in time while the quizmaster's has already revealed, and the
answer arrives after it. That fits "definitely in time", Q1 only, and later questions being fine.
It does **not** explain why it started on 6 October — something about her device or connection,
or #67/#69 (6 Oct), would be the next thing to check.

**The discriminator is still what her screen said on Q1** — *You didn't answer* (write never
sent) or *didn't reach the room in time* (sent, late). Same open question as 6 October. Ask her.

Not done: no code changed; nothing replayed; no browser repro of a lagged Q1.

## 2. Is the big game off limits after two rounds this morning?

**No.** Firestore reads (Spark) are 50,000 a day, reset 08:00 UK ([`cost.md`](cost.md)). Both
rounds were after 08:00 (finished 09:52 and 09:59 BST), so they count against today. Estimated
with `cost.md`'s formula, `Q·N² + 3·Q·N`: Tune 20×25 + 300 = **800**, Catchphrase 10×25 + 150
= **400**, plus this investigation's 33 — **about 1.2k of 50k**. A 30-player round is 14.6k /
20.6k / 26.6k / 32.7k for 10/15/20/25 questions. **One 30-player round of ≤20 questions still
fits with room to spare; two still do not.** Estimates, not Google's counter (Spark can't read
it).

## 3. Catchphrase needs more questions

Batch 4 (90 → 120) written by a subagent so Greg stays blind — see
[`catchphrase-batch-4.md`](catchphrase-batch-4.md) on its branch. Not drawn, seeded or
deployed: Greg runs `npm run draw-overnight`, and nothing goes live on a 30-player day.

## 4. Name the artist

Parked, not built: [`parked-ideas.md`](parked-ideas.md#4-name-the-artist--parked-9-october-2026).

## 5. Cass's answer, later the same day

**Greg, 9 Oct:** Cass recalls **neither** message, is sure the round behaved normally, and
simply did not have the points. She is watching for it next time. Taken at face value this
weakens the shared-clock theory in §1: a late answer should read *didn't reach the room in
time* (`verdictFor` → `lost`, `src/engine/scoring.ts:299`), and no answer *You didn't answer*.

**One more route, read in code, not tested:** `liveAnswers` (`src/engine/answers.ts:91`) drops
an answer whose `questionIndex` isn't the question in play, or whose uid the room does not list
in `players` — and the screen's own answer comes from the same filtered map, so she would read
*You didn't answer* there too. Every known path shows *some* verdict; if she truly saw a normal
reveal with her pick, none of them explains it. A second watcher on her screen at Q1 is the
cheapest next evidence.
