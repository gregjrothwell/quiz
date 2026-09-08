# What to build next, and why you cannot A/B test yet

> **Owner: Greg Rothwell. Last updated: 8 September 2026. Budget: 250 lines.**

Research, not a plan to approve. Greg asked for the next two or three most
valuable things with the homework done, and raised A/B testing because several
recent features have ended on *"hard to say without testing"* —
[`melody-round.md`](melody-round.md), the wager, the steal share.

**He is right about the cause and the fix is smaller than the framework.**

## The finding that reframes it

**Every "hard to say" has the same cause: the numbers were never kept.**

`rooms/{code}/answers/{uid}` is **one document per player, overwritten every
question**. At the end of a round the subcollection holds exactly the last
question and nothing else. Checked, not assumed — `3QDV` finished fifteen
questions and holds eight answer documents, all on question fifteen.

What *does* survive, which makes the gap precise and the fix small:

| | Survives | Where |
|---|---|---|
| Which questions were asked | **yes** | `rooms/{code}.questions`, with id and difficulty |
| What the right answer was | **yes** | `rooms/{code}/reveal/{questionId}` — 15 of 15 on `FWAP` |
| Final scores | **yes** | `rooms/{code}.scores` |
| **What each player picked, and how fast** | **no** | destroyed as the round runs |

So the questions and the answers are both kept; only the *responses* are lost.
And rooms expire — `expiresAt` and `prune-rooms` — so even that is temporary.

**You cannot A/B test anything until this changes, whichever feature you test.**

## 1. Keep the round

**One write at the end of a game.** Not a framework, and not a feature anybody
sees.

| | |
|---|---|
| Firebase | **1 write, 0 reads, 0 listeners** |
| Ruleset | one `match /games/{gameId}` block — **paste required** |
| Blocks | nothing; the client already holds all of it |

- **`games/{gameId}`**, holding the pack, the players, and per question: the id,
  its difficulty, the correct index, and each player's `optionIndex`,
  `elapsedMs`, `firstMs` and `wager`. Roughly 120 answer records for a
  fifteen-question round of eight — nowhere near the 1 MiB document ceiling.
- **Written by the quizmaster's client when the room reaches `finished`**, where
  `recordGame` already runs. The data is already in memory: `useGameLog`
  re-derives every reveal on every client, which is `scoring.md` AC#6.
- **It must not be a room subcollection.** Every client holds an unfiltered
  listener on those, so an in-room collection adds a second `Q·N²` term to the
  read cost of every game ([`cost.md`](cost.md#the-number-that-matters-is-not-1812-it-is-the-shape)).
  `questionVotes` is global for exactly this reason and nothing in the app reads
  it back — the fold runs on the Admin SDK, out of band. **Copy that shape.**

**What it unblocks, all of which are currently blocked on the same thing:**
A/B testing anything; the Ladder below; diagnosing the melody round properly
rather than from aggregate scores; and answering "how did that actually play?"
about any feature, ever, without asking people to remember.

## 2. The melody round — and it is the right first experiment

Known broken: eight players abandoned it after four of fifteen and went and
played Science instead ([`melody-round.md`](melody-round.md)). Three candidate
causes and no way to choose between them by reasoning:

1. **Clip length** — median 3.45s, 20 of 70 under three seconds, played **once**,
   into a fifteen-second window with `stopClock()` killing the bed underneath.
2. **The pool** — public domain means composers dead before 1956, so it is
   classical, marches and music hall.
3. **The distractors** — question 3 was four Bach pieces. The pool being narrow
   makes questions *harder*, not easier.

**It is the right first experiment because a melody round is fifteen questions
times eight players — 120 observations a round, ~60 per arm.** Detecting a hit
rate moving from 37% to 55% needs about 120 per arm, so **two rounds** answers it.

**Randomise within the round, not between rounds.** Alternate the variant by
`hash(gameId + question.id)` — deterministic, so every device agrees, which is
the same requirement the jigsaw scramble has and for the same reason
([`round-types.md`](round-types.md)). Every player then experiences both arms,
which removes between-player variance; the live scores range 2,400 to 8,000, so
that variance is not small.

**Cheapest first arm: let people hear it again.** A replay button, or loop the
clip through the window. It aims at the dead air — roughly 11.5 seconds of
silence on a fifteen-second question — and costs no content work, where
lengthening the tunes is 70 hand-edits.

## 3. The Ladder stops climbing

Already outstanding ([`HANDOVER.md`](../HANDOVER.md) item 4): once a pack's thin
`easy` or `hard` bucket is spent, `ramp` substitutes medium rather than
repeating. Correct, and not what the tile promises.

The recorded fix is `stats/{questionId}` — real difficulty from real play rather
than the harvester's label. **That is precisely what §1 produces**, so this stops
being a build and becomes a query. Third rather than second only because nobody
has complained about it, where eight people walked out of a melody round.

## The wager tweak — answered, and do not A/B it

> "Someone suggested a tweak to the last question bet where you had to select
> the percentage before seeing the answer." — Greg, 8 September

### The data already says what the tweak would do

26 stakes across the four finished wager rounds, read off the live project with
each outcome resolved against the vault:

| Stake | n | Right | Hit rate |
|---|---|---|---|
| Nothing (0%) | 7 | 2 | **29%** |
| Hedged (25/50%) | 6 | 3 | **50%** |
| All in (100%) | 13 | 8 | **62%** |

**Monotone.** Staked anything: 58%. Staked nothing: 29%. The shape you get if
people are reading the question and betting on what they see.

**n = 26 is too small to call significant** — the two-group split lands around
p ≈ 0.18 — and the gradient runs the right way across three bands, which is
worth more than the p-value at this size. Stated plainly because the tempting
move is to quote 62% against 29% as if it were settled.

So **the last question is currently a skill test.** Moving the stake in front of
the question makes it a lottery, which is exactly what the suggestion says it
would do. That is a taste question — "more chance is more fun" is not something
a hit rate can settle — and it should be decided as one rather than measured.

### Why it is the worst possible first experiment

**The wager fires once per round.** 26 stakes across four rounds is 6.5 per
round. Detecting a hit rate moving 58% → 40% needs roughly 120 per arm, so 18
rounds per arm, **37 wager rounds** — against **five that have ever been
played**. A crossover design halves it and it is still years.

**The rule that falls out, and it generalises past this one idea:**

> **A/B test per-question things. Never per-round things.**

A melody clip length gets ~60 observations per arm *per round*. A wager gets 6.5
per round in total. Same room, same night, three orders of magnitude apart —
because one fires fifteen times a round and the other fires once.

**If Greg wants to try blind staking anyway: play one round that way and ask the
room.** Eight opinions settle a taste question better than 26 noisy outcomes, and
it costs one evening instead of two years.

## What is deliberately not here

- **An experiment framework.** Variants derived from `hash(gameId + question.id)`
  cost nothing and need no paste, the same argument the jigsaw made. Build the
  first one inline; extract a framework when there is a second.
- **Bounding `elapsedMs` server-side** (`ideas-review.md` §5) — still unbuilt,
  still the companion to the wager, and now also the companion to `firstMs`.
- **The picture round.** Never played with people. It needs a round, not a
  decision, and nothing here changes that.
