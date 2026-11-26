# A house round — the lobby starts from the last one, and says it in one line

> **Owner: Greg Rothwell. Last updated: 26 November 2026. Budget: 250 lines.**

**Status: built 25 November 2026, PROJ-183, as a draft pull request. Not live.** Based on #212
(PROJ-182); it goes live with that release, on Greg's words. **Greg, 26 Nov 2026:** the look "ok"
(before and after at 1366×768, shut and open), and the squad and sound check under the packs "ok".

## Story

As the quizmaster, I want the lobby to start from how I ran the last round and show it in one line, so
that I pick a pack and press Start.

Why: over 79 kept rounds one person hosted 60, a new room started from fixed defaults, the pace was
changed on half of rounds and the ending on 77% ([`ui-ux-review-the-show.md`](ui-ux-review-the-show.md),
finding 2).

## Acceptance criteria

Drafted on the ticket. Greg was shown them twice and said to build it ("in this one", 25 November), so
they are **treated as approved**. No separate yes to each one is on record.

1. This device remembers the last round's settings, and a new room starts from them.
2. Above the packs, one line says every setting that is on, with a Change control.
3. The pickers sit behind Change; the packs follow the room code.
4. Nothing is on that the line does not say.
5. The pack is never remembered, and The Double is not.
6. No rules change and no room-document change.

## How it works

- **Three shapes in `src/engine/houseRound.ts`.** `RoundSettings` is what was *picked*, and all that is
  remembered. `RoundPlan` is what will be *played*, after the pack has had its say. `roundLine` is the
  plan in words and reads nothing else.
- **The line and Start are the same object.** The lobby makes one plan, writes the line from it and hands
  it to `onStart`. `SAYS` is keyed by the plan's fields, so a setting added without words does not compile.
- **The memory** is six settings in local storage (`src/lib/rememberedRound.ts`, `vibequiz.houseRound`),
  written by the device that presses Start: length, level, clock, ending, steals, Mr Fries. Not the pack,
  The Double, the jigsaw or the Slop Cannon. App keeps a copy for the tab.
- **`played`** is whether a question has ever opened in the room, off `openedAt`. The modes cannot say: a
  last round with everything off reads like a room nobody has played in.

## Decided here

| Question | Answer | Who |
|---|---|---|
| A brand-new device | The defaults it always had, said in the line | Claude, from the criteria |
| The room's last round or the device | The room, for its ending, steals, Mr Fries and clock. Length and level are never on the room, so they are the device's | The brief |
| A remembered setting the pack cannot play | The line says what will be played; the pick is kept and comes back with the next pack | The brief |
| What is remembered | The pick, not the pack's override: Theme Tunes being ten seconds is not a change of pace | Claude |
| A level the pack has none of | Played as it comes, rather than a dead Start with nothing on screen to say why | Claude |
| Survey Says | Ten questions, no level, no stakes, steals or Mr Fries, and the line says so | As before, now said |
| The ending when nothing is picked | "ends on the last answer" is said: the ending is changed most often | Claude |
| In The Double | "10 questions this half" | Claude |
| "The packs follow the room code" | Read as: the code, the link and **who is in the room**, then the packs. The quizmaster's squad and sound check move under the packs | Claude; Greg "ok", 26 Nov |
| A new mode's sticker | Shown beside This round too, or the fold would hide it | Claude |

**Assumed, not asked:** a player who is not the quizmaster sees exactly what they saw. Every screen but
the quizmaster's is untouched.

## Nothing moves under the pointer

- Change is above what it opens. The line keeps the rows its longest reading needs at each width, so a
  desktop strip has an empty row under a short line: the stylesheet allows four widths only, and a 1,024px
  window needs the second.
- **Found by measuring, then fixed.** With the pickers open above the packs, pressing Survey Says takes four
  pickers out and the cards jumped 516px on a laptop and 955px on a phone, putting another pack under the
  next click. Chrome's own scroll anchoring did not help. The pressed card is now held where it was, before
  the paint.

## Evidence, 25 November 2026

- Unit tests: `houseRound.test.ts`, `rememberedRound.test.ts`, `Lobby.house.test.tsx`. Criterion 4 is tested
  as a property twice: over every combination on five kinds of pack no two different rounds read the same,
  and every button behind Change, found rather than listed, changes the line whenever it changes the round.
- Eleven deliberate breaks, each caught, with the unbroken run (101 tests) clean before and after: steals and
  the final left out of the line; the line made from the picks; the pack and The Double remembered; more than
  six settings stored; unreadable storage; a stale value kept; the device beating the room; a pack's override
  remembered as a pick; the pickers open to begin with.
- In Chrome, in the gallery: every line the lobby can write (1,740) at twenty widths from 320 to 1920 leaves
  the strip one height; 88 presses of Change and of packs at four sizes, none moved. The same script
  reported 140 moves before the fix, so it can fail.
- Lobby height, in the gallery with all 25 packs and the What's new teaser, quizmaster:

| Size | Before | After, shut | First pack before → after |
|---|---|---|---|
| 1366×768 | 3,275px, 4.26 screens | 2,399px, 3.12 | 947 → 825px |
| 1920×1080 | 3,376px, 3.13 | 2,501px, 2.32 | 1,015 → 893px |
| 375×812 | 7,095px, 8.74 | 5,302px, 6.53 | 1,385 → 1,225px |

**The review's estimate of about 1.5 screens was wrong**: the 25 cards are 1,108px of it on their own. Live
measured 3,639px on 11 November with more hints showing, so the gallery is not the same figure.

## Not covered

- **Nobody has used it.** Greg has seen the pictures (26 Nov, "ok"), not a live lobby.
- `e2e/house-round.spec.ts` had **not been run when it was committed**; CI's first run of it is on the pull
  request. Locally only `asked-history`, `beat-the-chaser` and `commentator` ran, and passed.
- After Name that Tune the same room's next lobby starts at ten seconds, as it does today.
- Pressing Back on the titles in a room that has played still puts the clock back to the last round's, as
  today. The line says so.
- The line is above the packs, so it is off screen at the bottom of the grid when Start is pressed.
- The Slop Cannon is dark, so a long list of shots in the line was not measured.
