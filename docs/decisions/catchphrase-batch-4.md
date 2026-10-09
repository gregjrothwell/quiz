# Catchphrase — the fourth batch

> **Owner: Greg Rothwell. Last updated: 9 October 2026. Budget: 250 lines.**

Thirty more puzzles, **90 → 120**, on the rules of [`catchphrase-batch-3.md`](catchphrase-batch-3.md),
leaning harder. **Greg plays this round blind**, so this file holds the batch's shape only;
the puzzles live in `scripts/hand-catchphrase-data.ts`.

## Why — 9 October 2026

- **Greg, 6 October**, after `RRGM` went 78% (from 93%): "a step in the right direction for
  difficulty — can probably push a bit higher" ([`catchphrase-difficulty.md`](catchphrase-difficulty.md)).
- **Today's round hit 74%**: *as given in this work's brief, not re-read here.* Nothing in this
  work touched live Firebase (it is a 30-player game day and the read quota matters).
- **Written and picked by a subagent** whose working Greg does not see, as batch 3 was.

## Built — 9 October 2026, specs only

**90 → 120 specs; the pack still ships 90.** Not drawn, not picked, not written, not seeded.

| Kind | Count | Hard | Mr Fries |
|---|---|---|---|
| Scene (one literal saying) | 6 | 3 | 4 |
| Rebus (two things make it) | 10 | 8 | 5 |
| Lettered (a word or number) | 6 | 3 | 6 |
| Sound-alike | 8 | 7 | 6 |
| **Total** | **30** | **21** | **21** |

- **21 hard, 9 medium, no easy.** Batch 3 was 10 hard, 20 medium. The labels are still
  Claude's guesses and get re-labelled from `games/` once played.
- **Literal scenes: 6 of 30** (batch 3: 9). The cap is a third.
- **8 carry lettering**: the six lettered puzzles and two sound-alikes. None of it is the
  answer (tested).
- **Six are titles**, three of them 80s or 90s; the rest are sayings.
- **Wrong answers that fit**, lever 3: each wrong option was chosen to share one of the
  picture's halves, or its subject, with the answer. A judgement, not a test.

## Checks before drawing

- **No option the pack already uses**, as an answer or a wrong one, within the batch or
  against the first ninety. Clean on the first run.
- **No new answer is the right answer in another pack.** Three candidates were: all three
  were answers in the hand-built Screens pack, and all were swapped before writing this file.
  Five answers that remain appear as an *option* in another pack: one as a wrong option on a
  Screens question, one as a Blankety Blank option (a single common word), the rest in the
  harvested trivia packs. Four wrong options are answers in Tunes (2) or Screens (2), kept
  because they fit the picture. Checked option by option, case and punctuation folded.
- **Against what Greg has seen:** two candidates were in the 2 October list he skimmed
  (`c113e46`), one with the same picture idea; both swapped. The one remaining hit there is
  an ordinary word in unrelated prose.
- **Earlier Quiz chats** (196 Claude Code and Cursor transcript files, this session's own
  excluded): one candidate was named as the source title of a Blankety Blank candidate in an
  earlier chat. It is not in the shipped Blanks pack; swapped anyway. Every other hit is an
  ordinary word in code or prose, or an album or film title from another pack.
- **Six swapped in all**, each for one of the same kind and difficulty.
- **Lessons from batch 3 applied in the scenes:** where another character is the clue it is
  described first and hard, or Mr Fries is left out (9 of 30 have no Mr Fries); the joke
  leads; particular objects are described by their look, not just named.

## Tests

`hand-catchphrase-data.test.ts`:

- **The third batch is now bounded** (`THIRD_END`) and **its 30 prompts are pinned by hash**,
  as the second thirty were when the third went on. The fourth is *not* pinned yet: batch 3
  rewrote four scenes at its redraws, so its prompts are pinned once picked and shipped.
- **The fourth batch** block: thirty, never easy, **mostly hard and more hard than the third
  had**, every kind set, at most a third one literal scene, each harder kind used, Mr Fries
  in more than half of this batch alone, no option the pack already uses, seeds absent or
  1–3.
- **Deny cases for the repeat check**, built from the third batch's last puzzle: a wrong
  option re-cased and re-punctuated is caught, its answer is caught, the same option against
  only the first sixty is *not* caught (so `before` must reach the third batch), and a clean
  fixture passes.
- The repeat helper moved to file scope so both batches share it; its body is unchanged.

`catchphrase-gate.test.ts` — **changed, and the change is a decision for Greg:**

- Before, it asked every spec for a `seed` and a Vision read, so a batch written before it
  was drawn turned `npm test` red. Batch 3's restore point `ad5d784` was committed red for
  exactly that reason.
- Now: every **picked** spec has a Vision read and nothing else does; no picked drawing
  prints its answer; and **only the end of the list may wait for a pick** — an unpicked spec
  before a picked one fails. Deny cases: a hole mid-list, a hole at the start. Allow cases: a
  waiting tail, none waiting.
- **Nothing unpicked can ship:** `write-catchphrase-pack` still refuses the whole run while
  any spec has no `seed`, and `seed-vault` reads `public/packs/`, which this does not touch.
  If Greg prefers the old strict gate, revert this one commit; the data commit stands alone
  apart from that test going red until the pick.

## Drawing — Greg runs it tonight

Not drawn here: it needs mflux, about three hours, and the charger.

**Checked without drawing**, from this branch, against the main checkout's
`.cache/catchphrase`, with `draw-overnight`'s own `sheetsFor` and the `isDrawn` rule (all
three versions on disk). It has no dry-run flag, so a scratch script imported both:

- **To draw: 30, spec numbers 91–120, contiguous.** None partly drawn.
- **All 90 earlier puzzles found drawn**, which is what shows the check reads the cache.
- **No seed: 30, the same 91–120.** Sheets now: 0. After the draw: **8 sheets, 4 puzzles a
  sheet, 90 cells**, numbered 91–120.
- **Run it from the main checkout** with this branch in it. The cache lives under the
  checkout; from a fresh worktree it would find no drawings and draw all 120.
- At batch 3's ~128 s a version, 90 versions is roughly 3.2 hours.

## Go-live, not done

1. `npm run draw-overnight` (Greg, on the charger, lid open).
2. Pick from the 8 sheets: four checks as before. Set `seed` on each.
3. `npm run write-catchphrase-pack`. It refuses until all 30 have a seed.
4. Pin the fourth batch's prompts by hash, as the third's are now.
5. `seed-vault -- --pack catchphrase`, then `host-room -- 10 --pack catchphrase`.
   **Not on a game day.**

## Evidence — 9 October 2026

`npm run typecheck` and `npm run lint` clean. `npm test`: **91 files, 1,415 tests passed.**
