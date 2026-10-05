# Catchphrase — the harder batch

> **Owner: Greg Rothwell. Last updated: 5 October 2026. Budget: 250 lines.**

Levers 2 and 3 from [`catchphrase-difficulty.md`](catchphrase-difficulty.md):
harder puzzles, and wrong answers that also fit. Mr Fries
([`mr-fries.md`](mr-fries.md)) is in most of them. **Greg plays this round
blind, so no puzzle, phrase, scene or drawing from this batch goes in this file,
in chat, or on his screen.** This file holds the shape of the batch only.

## Why now — 5 October 2026

**Greg:** "I want to do the harder puzzles now," ahead of the Bonus Catchphrase
being played. The live data agrees, read with `npm run asked-probe` at the
time of writing:

- **Catchphrase has no runway.** `season-2/catchphrase` holds **30 ids of 30**,
  last written today. The next round would be all repeats.
- **It is played**: `H4DS` (2 October, Greg alone) and `K3EN` (5 October,
  seven seats). That passes the growth rule, which goes by play share times
  runway and never by how cheap a pack is to grow.
- Noted, not acted on: **Sleeves is spent too**, 105 asked from 104.

## The story — for Greg to approve

> As the quizmaster, I want a new batch of Catchphrase puzzles that have to be
> worked out rather than read at a glance, so the round stops being 93% right
> at 1.7 s, and the next round is not all repeats.

1. **30 new puzzles, taking the pack to 60.** That is two fresh rounds of 15.
   The asked history deals unseen ones first, so the next rounds are all new.
2. **The harder kinds, which the show used and the first 30 mostly did not:**
   - **two pictures that make one phrase**, each half a clue;
   - **a picture plus a word or a number**, the lettering never the answer;
   - **sound-alikes that only land when said aloud**;
   - a few **80s and 90s titles**, drawn the same ways.

   No more than a third of the batch is one literal scene of one saying, which
   was most of the first 30.
3. **Wrong answers that fit as much of the picture as the right one.** Each is a
   real, well-known phrase that matches most of what is drawn; only the right
   one matches all of it. A test still refuses a wrong answer that is just a
   rewording of the right one.
4. **Fair:** every word of the answer is shown, lettered or said by the picture.
   Nothing rests on knowledge the picture does not give. The office's
   *Rubbish* vote stays the backstop.
5. **Mr Fries in more than half**, doing the thing the phrase describes
   (`friesShareOk`, already built). Never in the first 30.
6. **Labels: medium or hard only, no easy.** "Hard" went 95% on 5 October, so
   these are Claude's guesses again, and get re-labelled from `games/` once
   they have been played (Outstanding 8).
7. **The same pipeline and the same seal.** `catchphrase-draw`, three versions
   each (about 2.8 hours of Mac time), with Claude picking each seed. The pick
   checks that it reads as the phrase, that the only lettering is what was
   asked for, that Mr Fries is on model, and that nobody else's character is
   in it. Vision reads every shipped drawing, and `seal.test.ts` and the pack
   writer are unchanged.
8. **Live:** `seed-vault -- --pack catchphrase` and `host-room -- 10 --pack
   catchphrase` before any deploy, **and not on Friday 9 October**.
9. `typecheck`, `lint` and `test` are clean. No rule, client or vault-shape
   change.

**How we will know:** the next office round's hit rate on the new 30 against
the old (93%), and the time from options to answer (1.7 s median). Target: a
hit rate under On the box's 83–90%, and answers spread out rather than bunched
on the moment the options land. That is a measurement, not a gate.
