# Lobby shelves — the pack cards, restyled

> **Owner: Greg Rothwell. Last updated: 20 October 2026. Budget: 250 lines.**

Handover item 18: "improve the styling of the category page" (Greg, 12 October). Confirmed 20 October: **both lobby card grids** — the quizmaster's "Choose a set" and the room's "Vote for a set". They share `.pack` and `PackFace`, so one change does both.

## What was wrong

The lobby listed packs in `index.json` order, which is harvest order: 21 identical tiles, the ten text-trivia packs first and the rounds the office plays last. Measured over the last 60 kept rounds (`read-games -- --last 60`, 9 Sep – 19 Oct): **45 were a show round** (Random Round 9, On the box 8, Name that Tune 8, Catchphrase 8, Sleeves 6, then Prices, Blankety Blank, Fine Art, Flags) and 15 were text trivia. The gallery hid it: its fixture has 10 packs.

## What changed

| | |
|---|---|
| Two shelves | **Show rounds** first, most played first; **Straight trivia** under it, in index order. `src/questions/shelves.ts`. A pack on neither list is trivia, so a new harvested pack lands with the others and a new show round is placed on purpose. |
| Random Round featured | Two tiles wide, a cyan-to-amber lit edge and a larger title: the one obvious press for a quizmaster who just wants a round. Exactly two tiles plus the gap at every breakpoint, so the columns below still line up. |
| Sound mark | A speaker in the corner of every card `packNeedsSound` names (Tunes, Sleeves, Name the Artist, Classical, Random Round). The lobby will not start those muted, and a player at a silent desk now knows before voting. Screen readers hear "Plays sound." |
| Gallery | *Lobby · every pack, quizmaster* and *Lobby · every pack, voting* (`#/preview/54`, `55`): all 21 at their published sizes. |

Unchanged: the vote, the leader's amber edge, the quizmaster's dashed "looking" edge, the pressed amber card, the counts pinned to the floor of each tile.

## Checked, 20 October 2026

- Gallery at 1024px: show shelf is 3 full rows of 4; trivia 4 + 4 + 2, centred.
- At 375px: one column, no horizontal scroll (`scrollWidth` 375), every card 343px.
- A pressed Random Round turns amber like any other card; *Quizmaster's looking* still shows on the voting grid. No console errors.
- `shelves.test.ts`: order, each pack once, unknown pack is trivia, empty shelf dropped.

**Not covered:** whether Greg likes it — a judgement, so the gallery is the review. The shelf order is fixed by the 20 October measurement, not live; re-measure if the office's habits move.
