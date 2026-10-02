# Catchphrase — is it too easy?

> **Owner: Greg Rothwell. Last updated: 2 October 2026. Budget: 250 lines.**

The first round of Catchphrase, what it measured, and the levers for making it
harder. **Nothing here is decided** — it is the starting point for the next
session. The round itself is [`catchphrase.md`](catchphrase.md). **No answers in
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

## Suggested order

**Play one office round first** — it costs nothing and turns a sample of one
into a sample of six to nine. Then, if the office agrees with Greg: **1** as a
same-day dial, **2 and 3** as the real fix (they change the puzzles, not the
rules), **4** if the hold alone still leaves the picture too readable. 5 and 6
only if the cheaper ones do not move the hit rate.
