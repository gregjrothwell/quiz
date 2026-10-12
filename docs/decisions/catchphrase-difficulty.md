# Catchphrase — is it too easy?

> **Owner: Greg Rothwell. Last updated: 5 October 2026. Budget: 250 lines.**

The first round of Catchphrase, what it measured, and the levers for making it
harder, and what was decided once the office had played it (5 October). The round itself is [`catchphrase.md`](catchphrase.md). **No answers in
this file:** Greg plays the round.

## The first round — `H4DS`, 2 October 2026, 16:25

**Greg:** "it's quite good but as suspected, is a tad easy."

Read off live Firestore with `read-games -- --game b667ef7e-…`:

| | |
|---|---|
| Seats | **1** — Greg alone, so no rank race |
| Questions | 10, The Ladder order: 3 easy, 4 medium, 3 hard |
| Clock | 10 s, so the options landed at 5.0 s |
| Right | **10 of 10** |
| Answered at | 5.8–8.1 s, median 6.5 s |
| **After the options landed** | **0.8–3.1 s, median 1.5 s** |
| By label | easy 1.3–2.4 s, medium 0.8–1.3 s, hard 1.8–3.1 s |
| Reveals | 0.4–0.6 s each, no refusals or stalls |

The game record holds no first-touch times for this round, so whether a pick
was changed cannot be read; only the final answer time.

### What it says, and what it cannot

- **The pictures are being solved from the picture.** 1.5 s from the options
  landing to a tap is scanning for a phrase already in mind, not reading four
  and weighing them. The hold is doing its job; the puzzles are what is easy.
- **The difficulty labels do not separate.** "Hard" took 2.0 s at the median,
  "easy" 1.7 s. The labels were Claude's guesses and this round does not support
  them — which matters for *Gentle* and *Fiendish* rounds, and for The Ladder.
- **n is one player and ten questions.** Thin. It is also not a blind read:
  Greg skimmed the first list of 30 on 2 October, and **17 of today's 30
  answers were in it** — counted against that commit, `c113e46`. Twelve were
  swapped for having been named in chat and one more for being undrawable. His
  10 of 10 may be partly recognition.
- **The real measurement is an office round**: six to nine players, a race,
  and a hit rate to set beside On the box's 83–90%.
- Greg has now seen **10 of the 30**. The asked history should deal the other 20
  first in his next rounds (`seasons/{season}/asked/catchphrase`), but the pack
  is a third spent for him.

## The office round — `K3EN`, 5 October 2026, 08:47

**Greg:** "pretty good but as suspected difficulty needs recalibrating."

Read off live Firestore (`read-games -- --game bb4708e2-…`, plus the raw
`games/` document for per-answer times):

| | |
|---|---|
| Seats | **7**, Greg among them |
| Questions | 15, The Ladder order: 5 easy, 7 medium, 3 hard. **None were in `H4DS`** |
| Clock | 15 s, so the options landed at 7.5 s |
| Right | **93%**; 4 of 7 players went 15 of 15. On the box: 83–90% |
| **After the options landed** | median **1.7 s**; 58% of answers inside 2 s, 88% inside 3 s |
| Hit rate by label | easy 94%, medium 92%, **hard 95%** |
| Greg | 15 of 15, median 1.4 s after the options landed |

- **The office agrees with Greg.** Seven people, not one, solved the pictures
  during the hold and tapped as the options arrived.
- **The labels do not separate, again.** Eleven of fifteen questions were 100%,
  so this round cannot re-label them either — there is nothing to rank by.
- **A longer hold would not move the hit rate.** The answers were known before
  the options landed; holding longer only shortens the race.

## Decided — 5 October 2026

**Greg: both — the Bonus Catchphrase reveal first, then harder puzzles.** Asked
how often, he said to mimic the show's frequency per round.

What the show did, from [UKGameshows](https://www.ukgameshows.com/ukgs/Catchphrase),
read 5 October 2026: **one Bonus Catchphrase per round**, under nine squares.
After each regular puzzle the person who solved it removed one square at random
and had a guess; wrong, and the round played another regular puzzle. A search
summary says two such rounds a show — **placeholder**, not confirmed from a
primary source; Wikipedia describes only the revival.

Offered two shapes, **Greg chose bonus question slots** over a bonus that runs
alongside the round. The faithful one needs a new answer field, a vault entry, a
rules paste and a screen; the slot needs none of those.

### The story — approved by Greg, 5 October 2026

> As the quizmaster, I want some Catchphrase questions to be a Bonus
> Catchphrase, the picture hidden under nine squares that lift one at a time,
> so that the round has puzzles nobody can solve at a glance.

1. **Every fifth question of a Catchphrase round is a Bonus Catchphrase** — the
   5th, 10th, 15th and 20th: 2 in a round of 10, 3 in 15, 4 in 20. Chosen by
   position, so every screen agrees with nothing new stored in the room.
2. A bonus question opens with **the whole picture under a 3×3 grid of
   squares**, at the picture's own shape — not cropped square like the jigsaw.
3. **The squares lift one at a time, evenly, on the room's shared clock**: one
   every tenth of the clock (Greg: "ok for now"), so the picture is whole for the last tenth (on a
   15 s clock, one every 1.5 s, whole from 13.5 s). The order is seeded from
   the question and game ids, so the same square lifts at the same moment on
   every screen.
4. **The options still land at half the clock**, as on every Catchphrase
   question. By then 5 of the 9 squares have lifted.
5. The prompt reads **Bonus Catchphrase** in place of *Say what you see*, so
   nobody thinks the picture failed to load.
6. **At the reveal every square is gone.** Reduced motion drops the animation,
   not the count.
7. **A bonus scores more** — Greg, 5 October. *How much is open*, and the
   season-best cap in `firestore.rules` (`maxBest()`) has to be read first:
   if it bounds what a round can score, more points may need a paste, which
   would break criterion 9.
8. **A late joiner** sees the options at once, as now, and the squares count
   from their own arrival, as the jigsaw's tiles do.
9. **Client only**: no rule change, no paste, no new field in the room or the
   game record. Which questions were bonus can be read off their index.
10. `typecheck`, `lint` and `test` are clean, and a dev build of the branch is
    checked in a live room on a bonus question — squares counted at three
    moments, options landing at half.

## Built — 5 October 2026

On `catchphrase-bonus` as `106863d`, **local, not pushed**. The logic is in
`src/engine/catchphraseBonus.ts`; the squares are drawn over the `<img>` in
`PicturePrompt`.

- **Criterion 7, settled:** Greg chose **double**: base and rank × 2, so first
  takes 2,000 and the floor 1,200. A stake and a steal are shares of what a
  player holds and are not doubled. `maxBest()` is 200,000. The worst case is
  25 questions with five bonuses (30k), a full wager (60k) and Share or Shaft
  (120k), so **no paste is needed**, and nothing in the rules bounds a single
  question's points.
- **Every round length ends on a bonus**, so with the wager on, the last
  question is both wagered and a bonus. Tested: right wins 2,000 plus the stake,
  and wrong loses the stake only.
- **Not in the story, added:** the hold's nudge reads *Double points. The
  options arrive at halfway.*, and the wager's zero-stake line says a bonus is
  still worth double.
- **No gap between the squares.** A gap would show nine slivers of the picture
  from the first frame.
- **Known limit:** the picture's URL is in the page from the first frame, so
  dev tools show it whole. This is the same trust model as the rest of the game.
- **Evidence:** typecheck, lint and 1,245 tests pass, with 11 new tests that
  failed before the code. The gallery fixture (`#/preview`, *Bonus Catchphrase,
  three squares up*) showed 3 of 9 up at 6 s of 20, with the grid exactly the
  still's 498×280 box. **Criterion 10's live room was not run:** Greg said to
  skip it, so the next office round is the check. Things to read off it: the
  hit rate on questions 5, 10 and 15 against the rest, and the answer times
  after the options landed.

### Open for the next session — Greg's idea, 5 October

**Researched 5 October, same day: [`mr-fries.md`](mr-fries.md)** — six drawings, a moving
prototype, and the decisions it leaves Greg.

**A house character, "Mr Fries"** — the show's Mr Chips was a gold robot in
most puzzles; ours would be a chip, in most *new* pictures. **Not redrawing the
30 already shipped.** Greg also remembers the show's pictures **moving a
little**, and asks how much that adds to the drawing pipeline. Not yet
researched. Questions to answer there, each checked against docs rather than
memory:

- **One character across many drawings.** Prompt-only Z-Image-Turbo has no
  reference image to hold a face; does `mflux` offer any for this model, or
  does Mr Fries get drawn once and composited into scenes?
- **Movement, cheapest first:** CSS on layers we already have (the character
  as a cut-out bobbing over a still) → a few frames from seeded variations →
  a local image-to-video model. The last is the unknown: size, speed on a
  24 GB M4 Pro, and licence.
- **What ships:** an animated file has to pass the same seal as a still —
  no prompt in its metadata, no lettering that is the answer.

**Not in this story:** harder puzzles and distractors that fit the whole picture
(levers 2 and 3) — the next one, once this has been played.

## The second office round — `RRGM`, 6 October 2026, 09:55 BST

The first round with Bonus Catchphrase and batch 3 (#67) live. 6 seats, a **10 s** clock, so
the options landed at 5 s.

| | `K3EN`, 5 Oct | `RRGM`, 6 Oct |
|---|---|---|
| Right | 93% | **78%** |
| Median after the options landed | 1.7 s | **2.8 s** |
| Answers inside 2 s of the options | 58% | **22%** |
| Batch 3 against the older 60 | — | 77% (10 questions) against 80% (5) |

**Greg:** "a step in the right direction for difficulty — can probably push a bit higher".
So the next batch aims harder than batch 3, by lever 2 and lever 3 above. Not started.

**Greg, same day, on the bonus:** "the answers should be there right away so people can guess
as the squares are removed". Built on `office-feedback-6-oct`: `optionsAtMs` takes the index
and returns 0 on a bonus, so the squares are the only thing hiding the answer. Ordinary
questions keep the half-clock hold. No rules change: the hold was only ever client-side.

## The levers, cheapest first

1. **Hold the options longer.** `OPTIONS_HOLD_SHARE` is one number
   (`src/engine/optionsHold.ts`): 0.5 → 0.7 lands them at 7 s of 10, leaving 3 s
   to find the phrase. It punishes matching, not knowing — and this round says
   the knowing is fast. **Does not make a puzzle harder to solve**, only less
   forgiving to the person who has not solved it.
2. **Harder puzzles.** The 30 are mostly one literal scene of one saying.
   The programme's harder ones combined parts: a picture plus a word or number
   (the blue moon in the trial), two images that make one phrase, a pun that
   needs saying aloud (the TV titles). Shift the mix towards those, and
   re-label by measurement, not by guess. Content work: new specs, drawings,
   a look at each.
3. **Wrong answers that also fit.** Today's distractors share the picture's
   subjects, but only the right one fits *all* of it. Choose ones that fit as
   much of the picture as the answer does. Cheap per puzzle; needs a careful
   eye.
4. **Uncover the picture during the hold** — Bonus Catchphrase. Squares lift on
   the shared clock (the jigsaw's seeded order and `settledTileCount` exist), so
   an early answer is a guess from part of the picture. Makes solving harder
   rather than matching harder, which is what this round asks for.
5. **Call it** — commit before the options land for a bonus, lose points if
   wrong. Rewards knowing; needs a rules paste for the new answer field.
6. **Typed answers.** Hardest by far, and the most build. Turned down for now
   in [`catchphrase.md`](catchphrase.md).

## Suggested order — 2 October, before the office round

Superseded by *Decided — 5 October 2026* above. It was: play one office round
first, then **1** as a same-day dial, **2 and 3** as the real fix, **4** if the
hold alone still left the picture too readable, and 5 and 6 only if the cheaper
ones did not move the hit rate. The office round said the hold is not the
problem, so **1** was skipped and **4** went first.
