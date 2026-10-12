# Catchphrase — the third batch

> **Owner: Greg Rothwell. Last updated: 6 October 2026. Budget: 250 lines.**

Thirty more puzzles, **60 → 90**, on the story in [`catchphrase-harder.md`](catchphrase-harder.md).
**Greg plays this round blind**, so this file holds the batch's shape only; the
puzzles live in `scripts/hand-catchphrase-data.ts`.

## Why — 5 October 2026

**Greg, 22:50:** "I feel like we need more catchphrases." Figures as given in this
work's brief, not re-read here: 60 puzzles, 30 unseen, about 2.3 fresh rounds, 2
rounds in its first 4 days. The pack-growth plan (`41fd0d2`, not on this branch)
had said to wait for the harder 30's live check; they are still unplayed, so this
batch keeps their rules and puts a few at the easier end of medium. **Written and
picked by a subagent** whose working Greg does not see (that plan's A4).

## Built — 6 October 2026

**60 → 90.** Kinds: 9 scene, 9 rebus, 5 lettered, 7 sound-alike. 20 medium, 10 hard.
Mr Fries in 20. Five are 80s or 90s titles. *Correction: the restore-point commit
`ad5d784` says Mr Fries in 21; one puzzle lost him in its redraw (below).*

- **The first sixty are unchanged**, and the second thirty's prompts are now pinned
  by hash as the first thirty's were.
- **New tests** (*the third batch*): thirty, never easy, every kind set, at most a
  third one literal scene, each harder kind used, Mr Fries in more than half of
  this batch alone, and **no option the pack already uses**, as an answer or a
  wrong one, with its own deny cases.
- **Against what Greg has seen:** no answer is in the 2 October list he skimmed
  (`c113e46`). No saying in the batch appears in an earlier Quiz chat (Claude Code
  and Cursor transcripts searched); the four hits were titles or words that other
  packs or the code use. A candidate that was an answer in two music packs was
  swapped out before drawing.
- **Drawn:** 90 versions in 3 h 13 min, then 12 for redraws in about 26 min:
  about 128 s a version, model load included. The Whisper audit ran alongside and
  was not stopped; nothing was slower than 200 s a version. On the charger
  throughout: 60% at the start, **58% at the lowest reading**, 60% after. *Not read
  from about 23:40 to 03:12* while the session was paused at its usage limit; the
  draw finished unattended at 02:22.
- **Claude picked every seed** on the four checks: reads as the phrase, only the
  asked-for lettering, Mr Fries on model, no look-alike. **26 from the first
  drawing, 4 redrawn once** with the scene rewritten, each with a good version.
  **None dropped.** Version 1 shipped in 16, version 2 in 4 and version 3 in 10; in
  at least 2 of those 10 it was the only usable one. That is a reading for the
  plan's B1, which asks whether two versions would do.
- **Lessons, no puzzle named:**
  - **Mr Fries took over the other character twice**, becoming the one doing the
    job or merging with the animal beside him. Where the other character is the
    clue, leave him out or describe it first and hard. One redraw left him out.
  - **A scene that opens with him can lose its key object**: one drew none at all.
    Lead with the joke, as the trial said.
  - **Describe a particular object's look, not just its name**: two came out as a
    generic version that did not carry the clue.
- **Checks:** Vision reads only the asked-for lettering on the 30 shipped (3 read
  it, 27 nothing). Typecheck, lint, 1,282 tests in 86 files, build and
  `check-bundle` clean. 30 new images, the largest 181 KB; none of the first 60
  changed. **Not seeded, not deployed.** Go-live: `seed-vault -- --pack
  catchphrase`, then `host-room -- 10 --pack catchphrase`.
