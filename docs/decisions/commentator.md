# The Commentator — story and acceptance criteria

> **Owner: Greg Rothwell. Last updated: 27 October 2026. Budget: 250 lines.**

**Status: APPROVED 22 October 2026, as recommended. Live with #136; captions only since the voice came out the same evening (below).** Greg: *"Approve all four stories as recommended: Mr Fries on pack×difficulty rates, room wins on more than half right, 🍟 until there's art, fix HANDOVER item 8; rig probe now and rig only on a pass; Commentator without Gemini, spoken from the host only, you draft ~30 lines; Wrapped's five cards opening 5 D[ec, Christmas finale left out for now]"* (the message was cut at 300 characters; the bracket is the rest of the button he pressed). Wow item 3 of
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

## Built 22 October 2026, branch `commentator`

- `src/engine/commentary.ts`: twelve facts, 30 draft lines
  ([`commentator-lines-draft.md`](commentator-lines-draft.md), for Greg to cut).
- **Read off the room only**, so every screen says the same (M3). The season
  facts the opening titles load ride on the room as `history` from the deal.
  So there are **no streak lines**: past picks are not on the room, and a
  device's own game log differs for a late joiner. The screen already says
  "N in a row" to the player concerned.
- **M2 as built:** a fact rotates through its lines by question, so the same
  fact twice is two different lines — until it has used all of them. Never the
  same line on consecutive questions; not "never twice in a round".
- `components/Commentary.tsx`: the caption on reveal (after the verdict),
  scoreboard and podium; `speak()` in `lib/sound.ts`, British voice where there
  is one, silent when muted, called on the host's device only (M5).
- No new listeners or reads (M7): it reads the room every screen already has.

## The voice came out — 22 October 2026, evening

Greg, after the live check round (`5SVU`, his Chrome, release #136): *"the
voice is terrible - remove it for now and we can re-introduce and reiterate."*
He also heard the standings' line spoken, then **the same audio again during
the podium animation**. Found 27 October 2026 (PROJ-59), before the voice
comes back.

The runaway line is only chosen on the standings. The podium's caption is a
different sentence (a debut, a first win, a season best). Rendering the #136
caption across that transition submits "…is running away with it" **once**.
Re-rendering it does not submit it again. One instance whose moment changes
from standings to podium submits the podium's own sentence, not the runaway
line a second time. Those three are not the repeat.

Two things in the #136 voice path are.

- **The once-guard was a ref on the component.** It dies when the caption
  unmounts, so a remount submits the same text again. The phase change itself
  does not remount the standings caption — it unmounts it and mounts the
  podium — but the guard has to survive a remount, and the ref does not.
- **`speak()` did `cancel()` then `speak()` on every line.** Chrome can finish
  an utterance and leave it paused in the queue, and `cancel()` does nothing
  while paused. The next `speak()` resumes that queue. The podium speaks when
  the winner lands, a few seconds into the animation, so the standings line
  plays again and then the podium's own line. This machine has no speech
  engine (Chrome reports `synthesis-failed`), so the native replay was not
  heard here. `createStuckQueue` is that engine, and the #136 order plays the
  runaway line twice on it. `resume()` then `cancel()` clears the queue
  without playing it out.

The voice stays off for players (M5 stays withdrawn). `speak()` is back behind
`window.__commentarySpeech`, which nothing in the live app sets. A line is
remembered for the game, so a remount or a second moment cannot submit it
again, and a new line flushes a paused queue first. The e2e recorder is that
queue and still expects no speech on any tab. M7's "off with sound off" holds
because a muted host's `speak()` does not submit.

- Captions are unchanged (M4).
- **The podium's caption read the live room** while everything else on that
  screen reads the table frozen at the whistle. When the winner pressed Leave,
  standings kept their places, nobody was first, and the line vanished. It now
  reads the frozen table; `Final.test.tsx` failed on the old wiring.
- Not flagged when the story was approved: these were the game's **first
  spoken words**. A voice returns only with a story of its own — which voice,
  when it talks, and how it sits over a tune.

## Cut from v1

Gemini or any AI rewording. Lines about questions' history. A choice of voice.

## Decided — Greg, 22 October 2026, as recommended

| Decision | Recommendation |
|---|---|
| Approve, with Gemini out | Yes |
| Spoken from the host's device only (one voice in the room) | Yes; every phone talking at once is the audio phasing problem |
| Captions on every screen even with sound off | Yes |
| I draft the ~30 lines for you to cut | Yes |
