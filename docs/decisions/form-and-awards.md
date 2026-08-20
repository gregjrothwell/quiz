# Form and the awards

> **Owner: Greg Rothwell. Last updated: 20 August 2026. Budget: 250 lines.**

Moved verbatim out of `docs/HANDOVER.md` on 20 August 2026, when that file reached
2,422 lines. The text is unchanged; only where it lives is.

## Form — the opening titles

**Shipped.** Before question one the room is told who it contains: the defending
champion, the best round of the season, who has the most rosettes, and who is
playing for the first time. Ten weeks of quizzes had left a column of numbers on
a screen most people looked at once, and every round opened as if nobody in it
had ever played before.

`formFor` in `src/engine/form.ts` is pure and tested; `ColdOpen` owns every word,
the same split as the awards and the review.

### It costs six reads, not three hundred

`loadForm` fetches one document per player in the room — read **once**, by
whoever starts the round, and written into the room document everybody is already
listening to. That is the reveal's pattern: one device pays, the rest learn it
from an update they were receiving anyway.

The obvious alternative is `loadSeason`, which is already there. It reads the
whole board — up to fifty documents — to answer a question about six people, and
every client would run it. Six against three hundred.

### The quizmaster starts the round, and nothing else does

**This was wrong in the first version and was found by playing a round.** The
titles ran for six seconds and then started the round themselves, so pressing
Start handed the beginning of the quiz to a `setTimeout`. Greg's report was
exactly right: *you lose control over the actual moment the quiz starts.*

The beginning is the one moment a quizmaster most wants to hold — while the room
reads the card, while somebody finds their drink, while you ask whether everyone
is ready. So the titles now wait. `Start the round` is a second, deliberate
press, with `Back` beside it for a pack chosen in error.

Two things make that safe:

- **The room cannot get stuck behind a quizmaster who wandered off**, because the
  role is derived from who has been present longest. If they close their laptop,
  somebody else inherits the button within a second. That is also why the old
  per-device timeout could be deleted rather than kept as a fallback.
- **The window rides inside the digest** (`form.durationSecs`) rather than on the
  quizmaster's device, so the round still opens on the window that was chosen if
  the chair changes hands while the titles are up. It cannot go on the room's own
  `durationSecs`: `timingOk()` pins that field to its previous value on every
  write except the one that opens a question, so writing it during the titles
  would be refused outright.

A room the season knows nothing about — one full of first-timers with no records
at all — has no titles worth showing and starts on the single press it was given.

### Why the titles live in the lobby

**Because the answering window is stamped by the server the moment a question
opens.** Anything laid over question one comes straight out of the room's
thinking time, which is the same reasoning that already put the round title card
on the standings screen rather than over the question.

So the round is introduced while the room is still in `lobby`, carrying a `form`
digest, and `start` follows six seconds later. This deliberately avoids a **new
phase**: the rules pin `phase` to five values, so a sixth would have cost a rules
republish, and the whole point of the Phase 2 ruleset was to be the last one.

### Three things that will bite

- **The round is started by an effect, not by `await sleep(...)` in
  `handleStart`.** `dispatch` closes over `room`, so anything awaited between
  taking that closure and writing folds the round over a snapshot that is however
  many seconds old — the same staleness that once let a pack fetch erase everyone
  who joined while it ran, measured at five of ten players. Six seconds of titles
  is a far wider window than that fetch ever was.
- **The card is time-boxed on every device, not just cleared by `start`.** A
  quizmaster who closes their laptop mid-sequence would otherwise leave the room
  on a title card nobody can clear. Every client runs its own timer from
  `form.at`, so the room falls back to a working lobby on its own.
- **`toRoomState` defaults `form` to null, and that is load-bearing.** Every room
  created before this has no field at all, and `undefined` is not `null` — the
  showing condition tests against null, so leaving it undefined would read as
  "the titles are up" in every older room.

### `playerId` on the player entry, at last

Phase 2 bounded it in the rules and deliberately left the client half unwritten.
This is the feature that needed it: the digest has to map uid to season record,
and the alternative is a `claims` read per player per game for something each
player can simply state about itself.

Written **only when it differs from the uid**, which needs a claimed recovery
code. Unconditionally it would put a redundant copy of the uid into every entry
in every room. The creator's entry carries it too — `createAndJoin` does not go
through `writeSelfIntoRoom`, so without that the one person guaranteed to be in
every room is the one whose record the titles could not find.

---

## The awards

Four rosettes under the final standings: fastest finger, comeback of the night,
the only one who knew, and boldly wrong. `src/engine/awards.ts` computes them and
is pure and tested; `src/components/Awards.tsx` owns the wording, the same split
as the lobby and its level names.

**The game keeps no record of itself, which is the whole difficulty.** The
answers subcollection holds one document *per player* and overwrites it every
question, and `useRoom` filters it to the current index — so `room.answers` is
only ever the question in play, and `lastDeltas` only the last one. By the final
screen, who answered what and how fast is gone.

`useGameLog` therefore accumulates it on each client as the game runs, in memory
only. Every client already receives every reveal, so this costs no reads, no
writes and no rules change, and identical input on every device means identical
awards. **The cost is that a reload loses it**, which is why `Final` only shows
awards when `log.length === room.questions.length`: a device that missed
questions would name different winners to the one beside it, and two screens
disagreeing about who was fastest is worse than neither saying.

**Confirmed on the live site**, 13 August 2026: a full ten-question game with
four players finished with all four rosettes on the final screen, which also
proves `useGameLog` caught every question — one short and nothing would have
shown at all.

Two rules the tests pin down, both about not lying:

- **An award nothing earned is left out, not shown empty.** A round nobody ever
  got right has no fastest finger, and inventing one from the wrong answers
  would be a confident lie.
- **Joint winners are sorted.** Ties would otherwise list by object key order,
  which differs between clients.

`contrarian` counts wrong answers *nobody else picked*. Being wrong with the
crowd is a bad question; being wrong alone is a decision. Note this needs three
or more players to mean anything — with two, every wrong answer is also a lonely
one.

---
