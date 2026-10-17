# Catchphrase — the sixth batch

> **Owner: Greg Rothwell. Last updated: 17 October 2026. Budget: 250 lines.**

Sixty more puzzles, **180 → 240 specs**, on the rules and the mix of
[`catchphrase-batch-5.md`](catchphrase-batch-5.md). **Greg plays this round blind**, so
this file holds the batch's shape only; the puzzles live in
`scripts/hand-catchphrase-data.ts`.

## Why — 17 October 2026

- **Asked for in this work's brief:** sixty specs, measured against play first. Specs only.
- **Batches 4 and 5 went live 12 October, 05:41 BST** (#72: 88 in, 2 dropped, pack 178).
  The one direct Catchphrase round since, `MNXU` on 13 October, read **26%**, against
  70–88% before. Most play since has been Random Round, which deals Catchphrase among
  other packs.
- **Written by a subagent** whose working Greg does not see, as batches 3 to 5 were.

### Measured — read-only, 17 October 2026

`read-games -- --last 40`, then `--game` on every round kept since 12 October, 05:41
BST. The game record keeps `packId: random` and no `sourcePack`, so each question id was
mapped to its spec through `stableId` (all 178 live ids mapped). **Hit** is right over
seats, as `read-games` counts it: a silent seat is a miss.

Twelve rounds were kept since then. **Ten served Catchphrase** (one direct, nine
Random Round); Science, Geography and a one-question harness round did not.
**29 Catchphrase questions, 183 seat-answers**, no question served twice.

| Since 12 Oct | Questions | Seat-answers | Hit | Answered | Right of answered |
|---|---|---|---|---|---|
| **All** | **29** | **183** | **64%** | **79%** | **81%** |
| Batches 1–3 (specs 1–90) | 0 | 0 | — | — | — |
| Batch 4 (91–120) | 13 | 81 | 67% | 79% | 84% |
| Batch 5 (121–180) | 16 | 102 | 62% | 78% | 79% |
| Scene | 8 | 47 | 60% | 77% | 78% |
| Rebus | 7 | 48 | 77% | 88% | 88% |
| Lettered | 4 | 26 | 73% | 88% | 83% |
| Sound-alike | 10 | 62 | **53%** | 69% | 77% |
| Labelled medium | 6 | 33 | 48% | 64% | 76% |
| Labelled hard | 23 | 150 | 67% | 82% | 82% |
| Bonus slot | 3 | 18 | 50% | 61% | 82% |
| Not a bonus | 26 | 165 | 65% | 81% | 81% |
| The direct round, `MNXU` | 10 | 50 | **26%** | **36%** | 72% |
| Random Round | 19 | 133 | 78% | 95% | 83% |

**Before, for comparison:** the six direct Catchphrase rounds of 5–9 October (batches 1–3
only) were 75 questions and 485 seat-answers: **82% hit, 95% answered, 86% right of
answered**. Sound-alike was the lowest kind then too, 65% over 16 questions.

What it says, and what it cannot:

- **`MNXU`'s 26% is mostly silence.** Only 36% of its seats answered (3 of 5 on the first
  question, 1 of 5 on the last two); of those who did, 72% were right. Seats in the nine
  Random Rounds answered 95% of their Catchphrase questions.
- **The new batches are harder among those who answer, but only a little:** 81% right of
  answered against 86% before.
- **The labels still do not separate:** medium went 48%, below hard's 67%. n is six
  medium questions.
- **Bonus slots, 50%, rest on three questions.** Too thin to read.
- **n is 29 questions across ten rounds.** Thin for anything finer than the whole.

### The mix — Claude's assumption, for Greg to overrule

The rule set in the brief: aim for **~60–75%**; in band, keep batch 5's mix; below ~55%,
ease off; above ~78%, push harder; too thin, keep batch 5's mix.

- **On the house measure, batches 4 and 5 landed at 64%: in band. Batch 5's mix is kept.**
- Two other readings disagree, and Greg may prefer either. **Random Round alone is 78%**
  and **right-of-answered is 81%**: both say push harder. The direct round's 26% says ease
  off, but that is seats not answering, not seats answering wrong.
- **No kind was cut.** Sound-alike measured hardest in both periods and is where most of
  the batch's difficulty comes from; it stays at 16.

## Built — 17 October 2026, specs only

**180 → 240 specs; the pack still ships 178.** Not drawn, not picked, not written, not
seeded.

| Kind | Count | Hard | Mr Fries |
|---|---|---|---|
| Scene (one literal saying) | 12 | 6 | 9 |
| Rebus (two things make it) | 20 | 12 | 16 |
| Lettered (a word or number) | 12 | 9 | 9 |
| Sound-alike | 16 | 15 | 15 |
| **Total** | **60** | **42** | **49** |

- **42 hard, 18 medium, no easy:** 70%, batch 5's share exactly. The labels are still
  Claude's guesses; the measurement above says they do not yet mean much.
- **Literal scenes: 12 of 60**, a fifth. The cap is a third.
- **The same kind mix as batch 5**, count for count.
- **12 carry lettering**, all of them the lettered kind. None of it is the answer (tested).
- **Three double as titles**; the rest are sayings and everyday phrases.
- **Mr Fries in 49 of 60.** Left out of 11, where another character or object is the clue.
- **Wrong answers that fit**, lever 3: each shares a half of the picture, or its subject,
  with the answer. A judgement, not a test.
- **Order in the file as batch 5:** sound-alike, rebus, lettered, scene.

## Checks before drawing

Every check is case- and punctuation-folded, with a leading article ignored. All read
local files only; nothing touched live Firebase except the read-only game reads above.

- **No option the pack already uses**, as an answer or a wrong one, within the batch or
  against all 180 earlier specs, the two dropped ones included. **Clean on the first run.**
- **Against what Greg has seen, the 2 October list** (`c113e46`): **no answer or option
  appears in it**, on the first run or the last.
- **No new answer is in a Blankety Blank phrase.** **One was**; swapped. New this batch:
  **wrong options too**, since Greg plays Blankety Blank blind and a wrong option that
  carries one of its phrases gives a blank away. **Two did**; both swapped.
- **No new answer is the right answer in another pack.** Checked against the local answer
  files `.cache/vault.json` and `.cache/hand-vault.json`, which cover **all 15,873
  published question ids** (15,695 in other packs, 178 Catchphrase), and the hand packs'
  data. **Two were**, both in harvested packs; swapped. *Not re-read from the live vault.*
- **No wrong option is the right answer in another pack.** **Five were** (three in the
  Sleeves data, one in a harvested pack, one in Music); all five swapped.
- **Kept, as batches 4 and 5 did:** **three answers** appear elsewhere as a *wrong* option,
  never the right one (one each in three other packs), and
  **four wrong options** are wrong options elsewhere.
- **Earlier Quiz chats:** **157 transcript files** (98 Claude Code, 59 Cursor), the five
  modified today excluded. First run: **19 hits across 6 answers. Two answers swapped:**
  one had been checked as a candidate in an earlier batch's work, one sat as a wrong option
  on an unshipped candidate. The final sixty: **13 hits across 4 answers**, each an album
  title, a film title in a Screens candidate list, a variable name in code, or a
  harvested question's wording. **None swapped.**
- **No prompt names its answer** and **no lettering is its answer**: the existing tests,
  clean on the first run.
- **Swaps: 14 in all — 5 answers and 9 wrong options.** Twelve were forced by the checks
  above (5 answers, 7 wrong options); two wrong options were changed by judgement while
  writing, one too close to another answer in the batch and one too close to its own
  neighbour. **Each answer was replaced by one of the same kind, difficulty and Mr Fries
  setting**, so the table above did not move.

**Pre-existing, reported and not changed:** **8 wrong options in 8 earlier specs** (all
shipped) overlap **6 Blankety Blank phrases**. A decision for Greg: leave them, or swap at
the next pick. The new test covers the sixth batch only, so it is not red for them.

## Tests

`hand-catchphrase-data.test.ts`:

- **The fifth batch is now bounded** at `FIFTH_END`: its `added` and its Mr Fries check
  stop at its own end. Batches 4 and 5 were **already pinned by hash** on 12 October,
  once picked and shipped; both pins unchanged.
- The fifth batch's *is sixty puzzles* failed with the sixty on the end and before the
  bound: that is the gate the brief described.
- **The sixth batch** block, eleven tests: sixty; never easy; **mostly hard and no smaller
  a share of hard than the fifth**; every kind set and at most a third one literal scene;
  each harder kind used; Mr Fries in more than half of this batch alone; no option the
  pack already uses; seeds absent or 1–3.
- **Deny cases for the repeat check**, from the fifth batch's last puzzle: a wrong option
  re-cased and re-punctuated is caught, its answer is caught, the same answer against only
  the first 120 is *not* caught (so `before` must reach the fifth), and a clean fixture
  passes.
- **New: no option carries a Blankety Blank phrase** (`blankClashes`), with its deny and
  allow cases beside it: a phrase re-cased is caught, a phrase inside a longer option is
  caught, an option that is two words of a phrase is caught, a clean fixture passes.
  **Proved on the data:** restoring one of the two wrong options it swapped turned the test
  red (`expected 1 to be +0`), and green again once removed.
- **Blind by construction:** every assertion in the new block reports counts or spec
  numbers, never a slug or an option, so a failing run prints nothing that spoils.

`catchphrase-gate.test.ts` — **no change.** Its waiting tail was always any length, so
the sixty unpicked at the end (181–240) pass, and a hole before a picked spec still fails.

## Drawn — 17 October 2026

**60 puzzles, 180 versions:** 5 on the Mac Mini (181–185, about 15 min each), 55 on the
MacBook in 4 h 52 min (median 5.3 min a puzzle; 6.4–11.3 h estimated before the draw),
**0 failed, 0 pauses**, and `draw.log` still prints no slug. The first started
a minute after `fb7468f`; the PNGs carry no prompt, so that is timing, not a file read.

## Picked — 17 October 2026

From the 15 sheets (`key.json`, number to slug), then every picked version again at full
size. **The four checks, as batches 3 to 5:** reads as the phrase, and the picture supports
the answer over the three wrong options; only the asked-for lettering; Mr Fries on model;
no look-alike. **Batches 4 and 5's precedent for a puzzle with no usable version: drop it,
not redraw.** Followed: nothing was redrawn, so no scene was rewritten.

| Specs 181–240 | Count |
|---|---|
| **Shipped** | **55** |
| Version 1 / 2 / 3 | 18 / 15 / 22 |
| Redrawn | 0 |
| Dropped, `misdrawn` | 5 — numbers 205, 211, 217, 220, 223 |
| Dropped, `spoiled` | 0 |

**Drops, by the check no version passed:**

- **Reads as the phrase: 4** (205, 211, 217, 220). In three, every version left out the
  part that singles the answer out, and a wrong option described the picture as well or
  better. In the fourth, every version drew the wrong thing in place of the one detail the
  puzzle turns on; it also fails the lettering check.
- **Only the asked-for lettering: 1** (223), on that alone. Every version added writing
  beyond its asked-for characters. The extra writing names no option and points to none.
  **A decision for Greg:** keep the rule (dropped, as now) or ship it (version 3 is its best).
- **Mr Fries on model, no look-alike: 0** drops.

**Versions set aside where another passed**, where that decided the pick: lettering 1,
Mr Fries 6 in 4 puzzles (merged or off model), look-alike 2 in 1 puzzle; the rest on reading.

**Weaker than written, shipped: 5** (182, 195, 226, 232, 235). A detail the scene asked for
is missing or changed, but the picture still supports the answer over the wrong options;
the first to re-label or retire once played.

**For the next specs, no puzzle named:**

- **Mr Fries beside another figure:** describe the other figure first and hard, or leave
  him out (batch 3's lesson, needed again). **A number or letter that acts:** say so first.
- **An object that normally carries writing:** say it carries none but the asked-for mark
  (both lettering failures). **A pile of things:** describe their look, not just the name.

**Vision, and a look by eye, on the 55 shipped:**

- **9 lettered:** 2 read their asked-for characters, each with one stray character that is
  not writing (checked by eye); 7 read nothing.
- **46 unlettered:** 41 read nothing; 5 carry a stray read, each checked by eye: marks, not
  writing.
- **None names its answer** (`write-catchphrase-pack` refuses one that does;
  `catchphrase-gate.test.ts` holds it offline). Every shipped version was also looked at
  whole for writing Vision missed: none beyond the asked-for characters.

## Written — 17 October 2026

- **Published Catchphrase: 178 → 233** (8 easy, 94 medium, 131 hard). 55 new stills, the
  largest 176 KB. **Every earlier question is unchanged** in the new pack.
- **Sealed:** no question carries an answer field; `src/questions/seal.test.ts` passes.
- **`.cache/hand-vault.json`** (the local answer cache): **2,163 → 2,218 entries**: 55
  added, one per new published id; none removed or changed. **Not seeded.**
- **`hand-catchphrase-data.test.ts`:** the sixth batch's **60 prompts pinned by hash**
  (`SIXTH_END`), the five dropped included, as the fourth's and fifth's are. **Proved:** one
  character added to one scene turned it red (a hash mismatch; it prints hashes only), green
  once restored. `added` stays open, so a seventh batch still trips *is sixty puzzles*.
  `catchphrase-gate.test.ts` unchanged: a dropped spec is no hole, and nothing waits.

## Go-live, not done

1. `seed-vault -- --pack catchphrase`, then `host-room -- 10 --pack catchphrase`.
2. Ships in that day's `release-<date>` PR (CLAUDE.md). Merging deploys: Greg's words.

## Evidence — 17 October 2026

- **Specs:** typecheck and lint clean; `npm test` **100 files, 1,536 passed** (1,525 before).
  The measurement read Firestore through `read-games` only and wrote nothing.
- **Pick:** typecheck and lint clean; `npm test` **100 files, 1,537 passed** (1,536 before;
  one new). `build` and `check-bundle` clean. No live Firebase read or written.
