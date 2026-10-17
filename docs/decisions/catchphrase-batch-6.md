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

## Drawing — not done

**Checked without drawing**, with `draw-overnight`'s own `isDrawn` and `sheetsFor` from a
scratch script, reading the main checkout's `.cache/catchphrase` through this worktree's
link to it:

- **Drawn: 180. To draw: 60, spec numbers 181–240, contiguous: 180 versions.**
- **No seed and not dropped: 60, the same 181–240.** Sheets now: 0. After the draw:
  **15 sheets, 180 cells**, 4 puzzles a sheet.
- **Time:** about **6.4 hours** at batch 3's ~128 s a version; about **11.3 hours** at the
  median of the 100 puzzles timed in `draw.log` (676 s a puzzle). The Mac Mini route
  (`scripts/draw-on-mini.sh`) suits either better than a MacBook night.
- **`draw.log` prints no slugs:** 234 lines, none containing one; its lines are puzzle
  numbers, counts and the battery.
- Run it where `.cache/catchphrase` is the real cache, as before: from a fresh checkout
  with no cache it would find nothing drawn and draw all 240.

## Go-live, not done

1. Draw the sixty (`draw-overnight`, or `draw-on-mini.sh start`).
2. Pick from the 15 sheets: four checks as before. Set `seed`, or `dropped`.
3. `npm run write-catchphrase-pack`. It refuses until every spec has one or the other.
4. Pin the sixth batch's prompts by hash, as the fourth's and fifth's are.
5. `seed-vault -- --pack catchphrase`, then `host-room -- 10 --pack catchphrase`.
6. It ships in that day's `release-<date>` PR with anything else going live (CLAUDE.md).

## Evidence — 17 October 2026

`npm run typecheck` and `npm run lint` clean. `npm test`: **100 files, 1,536 tests
passed** (1,525 before; eleven new). The measurement's scratch scripts read Firestore
through `read-games` only and wrote nothing.
