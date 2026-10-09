# Catchphrase — the fifth batch

> **Owner: Greg Rothwell. Last updated: 9 October 2026. Budget: 250 lines.**

Sixty more puzzles, **120 → 180**, on the rules and the lean of
[`catchphrase-batch-4.md`](catchphrase-batch-4.md). **Greg plays this round blind**, so
this file holds the batch's shape only; the puzzles live in
`scripts/hand-catchphrase-data.ts`.

## Why — 9 October 2026

- **Asked for in this work's brief:** sixty specs, written while the fourth batch is drawn
  but not yet picked. Specs only.
- **Greg wants harder**, as for the fourth: mostly hard, some medium, no easy
  ([`catchphrase-difficulty.md`](catchphrase-difficulty.md)).
- **A 30-player game day.** Nothing in this work read or wrote live Firebase. The answer
  checks below read local files only.
- **Written by a subagent** whose working Greg does not see, as batches 3 and 4 were.

## Built — 9 October 2026, specs only

**120 → 180 specs; the pack still ships 90.** Not drawn, not picked, not written, not
seeded.

| Kind | Count | Hard | Mr Fries |
|---|---|---|---|
| Scene (one literal saying) | 12 | 6 | 10 |
| Rebus (two things make it) | 20 | 12 | 15 |
| Lettered (a word or number) | 12 | 9 | 9 |
| Sound-alike | 16 | 15 | 13 |
| **Total** | **60** | **42** | **47** |

- **42 hard, 18 medium, no easy:** 70%, the fourth batch's share exactly (21 of 30). The
  labels are still Claude's guesses and get re-labelled from `games/` once played.
- **Literal scenes: 12 of 60**, a fifth, as in the fourth. The cap is a third.
- **The same kind mix as the fourth, doubled.**
- **12 carry lettering**, all of them the lettered kind. None of it is the answer
  (tested).
- **Six are titles**, one of them 90s; the rest are sayings. Fewer titles than planned:
  the title candidates were the ones most often already an answer somewhere else (below).
- **Mr Fries in 47 of 60.** Left out of 13, mostly where another character or object is
  the clue, which was batch 3's lesson.
- **Wrong answers that fit**, lever 3: each wrong option shares one of the picture's
  halves, or its subject, with the answer. A judgement, not a test.

## Checks before drawing

Every check is case- and punctuation-folded, with a leading article ignored.

- **No option the pack already uses**, as an answer or a wrong one, within the batch or
  against the first 120 (the fourth included, though unpicked). Clean.
- **Against what Greg has seen, the 2 October list** (`c113e46`): **five candidate
  answers were on it**, three with the same picture idea and two as wrong options there.
  All five swapped before the file was written. Four wrong options were also on it; all
  four swapped. Re-run on the final sixty: **no answer or option appears in it.**
- **No new answer is in a Blankety Blank phrase.** The existing test
  (`blanks-core.test.ts`) caught **one**; swapped.
- **No new answer is the right answer in another pack.** Checked against the hand packs'
  data and the local answer files `.cache/vault.json` and `.cache/hand-vault.json`, which
  between them cover **all 15,785 published question ids**. **Seven were**: three in the
  hand-built packs (Screens 2, Tunes 1) and four in the harvested packs. All seven
  swapped. *Not re-read from the live vault: a game day.*
- **Two answers that remain appear as a wrong option** in harvested packs, never as the
  right one, as five did in the fourth batch. Kept.
- **No wrong option is the right answer in another pack.** Ten were (Tunes, Sleeves, the
  harvested packs and one unpublished hand answer); **all ten swapped**, where the fourth
  batch kept four. Ten wrong options remain that are a *wrong* option elsewhere; kept.
- **Earlier Quiz chats:** 203 Claude Code and Cursor transcript files, this session's own
  excluded. Twenty hits across nine answers, every one an ordinary word in code or prose,
  a line number, a trivia question from another pack, a painting title, or a film title as
  a wrong option in a Screens candidate list. **None swapped.**
- **One prompt named its answer** on the first test run; reworded, then swapped out for
  another reason anyway.
- **27 swaps in all: 13 answers and 14 wrong options.** Each answer was replaced by one
  of the same kind; two came back a step different in difficulty, and two other puzzles
  were relabelled so the batch stayed at 42 hard.

## Tests

`hand-catchphrase-data.test.ts`:

- **The fourth batch is now bounded** (`FOURTH_END`), and its Mr Fries check stops at
  its own end. It is *not* pinned by hash yet: it pins once picked and shipped, as the
  third did.
- **The fifth batch** block: sixty, never easy, **mostly hard and no smaller a share of
  hard than the fourth**, every kind set, at most a third one literal scene, each harder
  kind used, Mr Fries in more than half of this batch alone, no option the pack already
  uses, seeds absent or 1–3.
- **Deny cases for the repeat check**, built from the fourth batch's last puzzle: a
  wrong option re-cased and re-punctuated is caught, its answer is caught, the same answer
  against only the first ninety is *not* caught (so `before` must reach the fourth), and a
  clean fixture passes.
- The fourth batch's *is thirty puzzles* failed with the sixty on the end and before
  `FOURTH_END`: that was the change the brief called "the gate".

`catchphrase-gate.test.ts` — **no code change.** Its waiting tail was always any length,
so two unpicked batches at the end (91–180) already pass, and a hole before a picked spec
still fails (its deny cases are unchanged). One comment says that two batches now wait.

## Drawing — not done

**Checked without drawing**, from the main checkout, with `draw-overnight`'s own
`sheetsFor` and `isDrawn` from a scratch script:

- **Drawn: 120**, the fourth included. **To draw: 60, spec numbers 121–180, contiguous.**
- **No seed: 90, numbers 91–180.** Sheets now: 8 (the fourth's). After this draw:
  **23 sheets, 270 cells**, numbered 91–180.
- At batch 3's ~128 s a version, 180 versions is roughly **6.4 hours**. The Mac Mini route
  (`scripts/draw-on-mini.sh`) suits that better than a MacBook night.

## Go-live, not done

1. Draw the sixty (`draw-overnight`, or `draw-on-mini.sh start`).
2. Pick the fourth and the fifth from the sheets: four checks as before. Set `seed`.
3. `npm run write-catchphrase-pack`. It refuses until all ninety have a seed.
4. Pin the fourth and fifth batches' prompts by hash.
5. `seed-vault -- --pack catchphrase`, then `host-room -- 10 --pack catchphrase`.
   **Not on a game day.**

## Evidence — 9 October 2026

`npm run typecheck` and `npm run lint` clean. `npm test`: **91 files, 1,424 tests
passed** (1,415 before; nine new).
