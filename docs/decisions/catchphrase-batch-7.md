# Catchphrase — the seventh batch

> **Owner: Greg Rothwell. Last updated: 27 November 2026. Budget: 250 lines.**

Sixty more puzzles, **240 → 300 specs**, on the rules of
[`catchphrase-batch-6.md`](catchphrase-batch-6.md) and a harder lean. **Greg plays this
round blind**, so this file holds the batch's shape only; the puzzles live in
`scripts/hand-catchphrase-data.ts`. Ticket PROJ-203.

## Why — 27 November 2026

- **Asked for in this work's brief:** sixty specs, measured against play first. Specs only.
- **Batch 6 went live 17 October, 21:34 BST** (#91: 55 in, 5 dropped, pack 233).
- **Written by a subagent** whose working Greg does not see, as batches 3 to 6 were.

### Measured — read-only, 27 November 2026

`read-games -- --last 60`, then `--game` on every round kept since 17 October, 21:34 BST,
run from the main checkout. Each question id was mapped to its spec through `stableId`;
every id in the two direct rounds mapped. **Hit** is right over seats, as `read-games`
counts it: a silent seat is a miss. The `--game` output was saved to files and read by a
script that prints counts only, because its last column is a question id.

53 rounds were kept since then; 10 were harness or test runs and were left out. Of the
other 43, **18 served Catchphrase**: two direct rounds (`BTAJ` and `64KV`, 16 November) and
all 16 Random Rounds. The other 25 were rounds of other packs, and served none.
**65 Catchphrase questions, 397 seat-answers**, no question served twice.

| Since 17 Oct | Questions | Seat-answers | Hit | Answered | Right of answered |
|---|---|---|---|---|---|
| **All** | **65** | **397** | **73%** | **96%** | **76%** |
| Batches 1–3 (specs 1–90) | 0 | 0 | — | — | — |
| Batch 4 (91–120) | 7 | 43 | 67% | 95% | 71% |
| Batch 5 (121–180) | 29 | 180 | 69% | 97% | 72% |
| **Batch 6 (181–240)** | **29** | **174** | **78%** | **97%** | **81%** |
| Scene | 11 | 68 | 81% | 96% | 85% |
| Rebus | 25 | 156 | 82% | 99% | 83% |
| Lettered | 10 | 62 | 85% | 98% | 87% |
| Sound-alike | 19 | 111 | **49%** | 92% | **53%** |
| Labelled medium | 20 | 122 | 77% | 97% | 80% |
| Labelled hard | 45 | 275 | 71% | 96% | 74% |
| Bonus slot | 6 | 36 | 92% | 100% | 92% |
| Not a bonus | 59 | 361 | 71% | 96% | 74% |
| Direct rounds, `BTAJ` and `64KV` | 30 | 180 | 79% | 98% | 80% |
| Random Round | 35 | 217 | 68% | 95% | 72% |

**Batch 6 alone, by kind:** scene 5 questions, 86%; rebus 10, 89%; lettered 5, 94%;
sound-alike 9, **51%** (54% right of answered). Medium 7, 88%; hard 22, 75%. Direct 11, 85%;
Random 18, 74%. Exactly: **136 right of 174 seats, 78.2%**; the three kinds other than
sound-alike together 110 of 123, 89%. Of its 29 questions, 13 went 100% and 4 under 50%.
**29 of its 55 shipped puzzles have been served.** The five shipped "weaker than written":
3 served, 17 seat-answers, 35%.

What it says, and what it cannot:

- **Silence is gone.** 96% of seats answered, against 36% in `MNXU`, the one direct round
  batch 6 measured. The misses now are seats answering wrong.
- **Batch 6 came out easier than 4 and 5** on the same mix: 78% against 69%.
- **Sound-alike is the outlier, both ways.** 49% across all batches, 10 of its 19 questions
  under 50%, and 53% right of answered: players pick, and pick wrong. The other three kinds
  ran 81–85% across all batches and 86–94% in batch 6.
- **The labels separate a little now:** medium 77%, hard 71% (batch 6: 88% and 75%).
- **Bonus slots, 92% over six questions.** Too thin to read.
- **Not the same game as batch 6 measured:** *call it* went live on 21 October, so every
  round but the first (`EE77`, 19 October) let a player type a call before the options.
- **n is 65 questions across 18 rounds, 29 of them batch 6's.** Thin below the whole.

### The mix — Claude's assumption, for Greg to overrule

The rule in the brief, as batch 6's: aim for **~60–75%**; in band, keep the mix; below ~55%,
ease off; above ~78%, push harder; too thin, keep the mix.

- **Read on batch 6 alone, as batch 6 read the batches it measured: 78.2%, just over the
  push-harder line. Pushed harder.** n is 29 questions; 0.2 points over a line marked "~" is
  inside the noise, so the other reading is fair too: **everything served since 17 October
  is 73%, in band, which says keep.** Greg may prefer that one (decision 1 below).
- **Harder only where it measured easy.** Scene, rebus and lettered ran 89% together in
  batch 6, so those three carry the push: **32 of their 44 are hard**, against 27 of 44 in
  batch 6, with wrong options that each share half the picture (lever 3).
- **Sound-alike, at 49%, is below the ease-off line, so it is not pushed.** It keeps its
  count (16) and its labels (all hard), and is written to land: every pun rests on things
  that are easy to name aloud and easy to draw, and no wrong option also sounds like it.
- **The kind mix is batch 6's, count for count.** Moving puzzles into sound-alike would push
  the batch harder on paper and leave the round split between near-certain and near-hopeless.

## Built — 27 November 2026, specs only

**240 → 300 specs; the pack still ships 233.** Not drawn, not picked, not written, not
seeded.

| Kind | Count | Hard | Mr Fries |
|---|---|---|---|
| Scene (one literal saying) | 12 | 8 | 9 |
| Rebus (two things make it) | 20 | 14 | 15 |
| Lettered (a word or number) | 12 | 10 | 11 |
| Sound-alike | 16 | 16 | 14 |
| **Total** | **60** | **48** | **49** |

- **48 hard, 12 medium, no easy:** 80%, against 70% in batches 5 and 6.
- **Literal scenes: 12 of 60**, a fifth. The cap is a third.
- **12 carry lettering**, all of them the lettered kind, and every lettered puzzle does
  (tested, new). None of it is the answer (tested).
- **Five double as titles**; the rest are sayings and everyday phrases.
- **Mr Fries in 49 of 60**, batch 6's count. Left out of 11, where another figure or object
  is the clue, or where he would stand beside a cast that the model might draw as more of him.
- **Batch 6's lessons, applied to all sixty:** in every scene that puts another figure beside
  him, that figure is described first; the 3 numbers that act say so first; 23 scenes say
  their object carries no writing (or only the asked-for mark), 6 of them lettered; piles
  are described by their look.
- **Order in the file as batch 6:** sound-alike, rebus, lettered, scene (241–256, 257–276,
  277–288, 289–300).

## Checks before drawing

Every check is case- and punctuation-folded, with a leading article ignored. All read local
files only; nothing touched live Firebase except the read-only game reads above.

- **The answers were chosen from a checked pool.** 265 candidate answers were run through
  every check below before any wrong option was written; 92 passed, and the sixty came from
  those. **On the first run of the sixty, every answer passed every check: 0 answer swaps.**
- **Wrong options, first run: 65 of 180 failed, across 45 puzzles.** By puzzle (one can
  fail several): 40 already in the pack, 45 in an earlier Catchphrase chat, 11 on the
  2 October list, 11 carrying a pack answer inside them, 2 carrying a Blankety Blank phrase,
  2 the right answer in another pack. 183 replacements were checked; 54 failed. **66 wrong
  options swapped in all**: the 65, then 1 more whose replacement failed on the second run.
  Only wrong options moved, so every puzzle kept its kind, difficulty and Mr Fries setting.
- **Final run, all sixty: 0 hits on every check.** No option the pack already uses (all 240
  earlier specs, the 7 dropped included; within the batch too). None on the 2 October list
  (`c113e46`). **No answer or wrong option carries a Blankety Blank phrase** (`overlapsWith`,
  as `blankClashes`). **None is the right answer in another pack**: `.cache/vault.json`
  (15,969 ids) and `.cache/hand-vault.json` (2,544 ids), both dated 2 November, and the hand
  packs' data. *Not re-read from the live vault.* No wrong option holds an answer.
- **Kept, as batches 4 to 6 did:** 1 answer and 4 wrong options appear as an option in
  another published pack, never its right answer.
- **Earlier Quiz chats:** 538 text files (Claude Code under `~/.claude/projects/*Quiz*`,
  Cursor's agent transcripts), every file modified today excluded. A hit counts against an
  option when the same message also mentions Catchphrase work; batch 6 judged each hit by
  hand, which a blind check cannot. **No answer appears in any earlier chat at all.** 7 wrong
  options appear only in messages about other things; kept.
- **No prompt names its answer** and **no lettering is its answer**: the existing tests, and
  the same check run on every draft first. Clean on the first run.
- **Slugs:** none used by any hand pack, and no new question id is already in either vault
  cache.

**For Greg to decide, from this session's tool results** (counts and numbers only):

1. **Push harder, or keep?** The batch is written to the push-harder reading. Keeping would
   mean relabelling and rewriting about six of the hard scene, rebus and lettered puzzles.
2. **Spec 1 was printed whole, and spec 2's slug, into one early tool result:** a redaction
   script misread a regular expression. Both shipped in the first thirty. Leave them, or
   retire or rewrite them at the next pick.
3. **The first check of the answer pool printed its reasons per candidate.** Read beside the
   pool in the same transcript, it marks 120 of those phrases as already in the pack, as an
   answer or a wrong option, and 21 as on the 2 October list; it names no puzzle or picture.
   Every later check printed one merged result per candidate, or the positions to swap.

## Tests

`hand-catchphrase-data.test.ts`:

- **The sixth batch is now bounded** at `SIXTH_END`: its `added` and its Mr Fries check stop
  at its own end. Its prompts were **already pinned by hash** when it was picked, 17 October;
  the pin is unchanged.
- The sixth batch's *is sixty puzzles* failed with the sixty on the end and before the bound
  (`expected 120 to be 60`), the only failure in the seven Catchphrase test files: the gate.
- **The seventh batch** block, twelve tests: sixty; never easy; **mostly hard and a larger
  share of hard than the sixth**; every kind set and at most a third one literal scene; each
  harder kind used; Mr Fries in more than half of this batch alone; no option the pack
  already uses; no Blankety Blank phrase; **only the lettered kind carries lettering, and
  every lettered puzzle does** (new); seeds absent or 1–3.
- **Deny and allow cases:** the repeat check, from the sixth batch's last puzzle: a wrong
  option re-cased, quoted and punctuated is caught, its answer is caught, the same answer
  against only the first 180 is *not* caught, a clean fixture passes. The Blankety Blank
  check from the *last* long phrase (the sixth's test takes the first): re-cased, inside a
  longer option, clean. The lettering check: lettering on a scene, a lettered puzzle without
  it, and a clean lettered fixture.
- **Proved on the data:** taking the lettering off spec 288 turned the new lettering test red
  (`expected [ 288 ] to deeply equal []`); the file restored byte for byte, green again.
- **Blind by construction:** every assertion in the new block reports counts or spec
  numbers, never a slug or an option.

`catchphrase-gate.test.ts` — **no change.** Its waiting tail was always any length, so the
sixty unpicked at the end (241–300) pass, and a hole before a picked spec still fails.

## Drawn — not yet

**To draw: 60, spec numbers 241–300, contiguous.** All 240 earlier specs have their three
versions on disk, so `draw-overnight` draws these sixty and nothing else.

- MacBook: `npm run draw-overnight` from this branch's worktree, its console sent to a file
  that is never printed. `draw.log`, `run.json` and the notification carry numbers only;
  **mflux's own console output names each file it saves, and the filename is the slug.**
- Mac Mini: `npm run draw-on-mini -- start`, then `-- status` (the last lines of `draw.log`).
  The Mini's console goes to `.cache/catchphrase/mini.out`, which holds the same filenames.
- At batch 6's MacBook median, 5.3 min a puzzle, about 5.3 hours; at the Mini's ~16 min a
  puzzle, about 16 hours.

## Picked — not yet

## Written — not yet

## Go-live, not done

1. Draw the sixty, as above.
2. Pick from the sheets: the four checks, as batches 3 to 6. Set `seed`, or `dropped`.
3. `npm run write-catchphrase-pack`, then pin the seventh batch's prompts by hash
   (`SEVENTH_END`) and bound its checks when an eighth goes on.
4. `seed-vault -- --pack catchphrase`, then `host-room -- 10 --pack catchphrase`.
5. Ships in that day's release PR (CLAUDE.md). Merging deploys: Greg's words.

## Evidence — 27 November 2026

- **Specs:** `npm run typecheck` and `npm run lint` clean; `npm test` **186 files, 2,661
  passed**, 12 of them new. The measurement read Firestore through `read-games` only and
  wrote nothing.
