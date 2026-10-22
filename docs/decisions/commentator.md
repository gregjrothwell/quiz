# The Commentator — story and acceptance criteria

> **Owner: Greg Rothwell. Last updated: 22 October 2026. Budget: 250 lines.**

**Status: DRAFT for Greg's approval. Nothing built.** Wow item 3 of
[`direction-oct-2026.md`](direction-oct-2026.md#5-wow--all-five-accepted).

## What changed since the idea was written

- **The Gemini rewording is out.** It was to sit behind the Lab, which Greg
  shelved on 22 October, and its free tier may use prompts for training. Every
  line here is written by hand, with the facts slotted in.
- **"First time anyone's got this one" cannot happen.** No question is asked
  twice (`beat-the-chaser.md`, the measurement). Callbacks have to be about
  *people and the room*, not questions.

## The story

> **As the room**, I want the quiz to notice what is happening to us — a
> streak, a first win, a record going — and say it out loud, **so that** a
> round feels commentated rather than scored.

## What it says, and from where

Every fact is one the app already holds on this device. No new reads.

| Moment | Example line | From |
|---|---|---|
| Reveal | "Three in a row for Ann." | game log (streaks) |
| Reveal | "Nobody got that. Not one of you." | the reveal |
| Reveal | "Only Bob. Lone wolf." | the reveal |
| Scoreboard | "Cass has never led a round before." | season rows (form) |
| Scoreboard | "New leader. Ann's been chasing that all night." | standings |
| Podium | "Bob's best round of the season." | season row `best` |
| Podium | "Ann's first win." | season row `wins` |

## Acceptance criteria

- **M1.** `src/engine/commentary.ts` is pure: given the room, the game log and
  the season rows the titles already loaded, it returns at most one line per
  moment, or none. Unit-tested per line, including "says nothing when nothing
  happened".
- **M2.** At most one line per reveal and one per scoreboard, and never the same
  line twice in a round.
- **M3.** Every device computes the same line from the same room (no randomness
  except seeded by `gameId`), so a room hears one voice.
- **M4.** Shown as a caption under the reveal and scoreboard on every screen.
- **M5.** Spoken by the **host's device only** via the browser's built-in
  speech, British English voice where one exists, behind the existing sound
  switch. Silent if speech is unavailable.
- **M6.** Lines never name a player who has left, never mention a score below
  zero, and never reveal a Survey Says answer before part two.
- **M7.** Off with sound off; captions stay. No rules change; no new reads
  (checked by counting listeners in the e2e round).
- **M8.** British office tone, as the question packs (`CLAUDE.md`): about thirty
  lines, written for Greg to cut, like the Survey Says prompts.

## Cut from v1

Gemini or any AI rewording. Lines about questions' history. A choice of voice.

## Open — Greg to decide

| Decision | Recommendation |
|---|---|
| Approve, with Gemini out | Yes |
| Spoken from the host's device only (one voice in the room) | Yes; every phone talking at once is the audio phasing problem |
| Captions on every screen even with sound off | Yes |
| I draft the ~30 lines for you to cut | Yes |
