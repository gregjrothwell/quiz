# Form and the awards

> **Owner: Greg Rothwell. Last updated: 27 October 2026. Budget: 250 lines.**

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

- **The room cannot get stuck behind a quizmaster who wandered off.** Leave
  hands the chair over in the same write. A host who vanishes is replaced once
  they have been gone from presence for 50 seconds and their beat has been
  silent for 75 (`CLAIM_AFTER_ABSENT_MS`, `CLAIM_AFTER_SILENT_MS` in
  `src/engine/host.ts`). That is also why the old per-device timeout could be
  deleted rather than kept as a fallback. The "within a second" line this
  bullet used to carry was the derived quizmaster, before W3 named a `hostUid`.
- **The window rides inside the digest** (`form.durationSecs`) rather than on the
  quizmaster's device, so the round still opens on the window that was chosen if
  the chair changes hands while the titles are up. It cannot go on the room's own
  `durationSecs`: `timingOk()` pins that field to its previous value on every
  write except the one that opens a question, so writing it during the titles
  would be refused outright.

A room the season knows nothing about — one full of first-timers with no records
at all — has no titles worth showing and starts on the single press it was given.
A round against Mr Fries still shows his card first; the host opens question one
from there.

### Why the titles live in the lobby

**Because the answering window is stamped by the server the moment a question
opens.** Anything laid over question one comes straight out of the room's
thinking time, which is the same reasoning that already put the round title card
on the standings screen rather than over the question.

So the round is introduced while the room is still in `lobby`, carrying a `form`
digest. The first version then started the round six seconds later. That timer
is gone: `start` is the quizmaster's second press (`handleBeginRound`). This
deliberately avoids a **new phase**: the rules pin `phase` to five values, so a
sixth would have cost a rules republish, and the whole point of the Phase 2
ruleset was to be the last one.

### Three things that will bite

- **`dispatch` closes over `room`.** Anything awaited between taking that
  closure and writing folds the round over a snapshot that is however many
  seconds old — the same staleness that once let a pack fetch erase everyone
  who joined while it ran, measured at five of ten players. The titles no
  longer wait inside `handleStart`; the second press is its own dispatch. Do
  not put the six seconds back on that path.
- **There is no per-device timeout on the card.** The first version time-boxed
  it from `form.at`, so a closed laptop could not leave the room stuck. That
  timer was deleted when the next person inherited the button. Putting it back
  would start the round without the quizmaster, which is the bug the second
  press fixed. Until the chair changes hands the room waits on the card — up
  to the 75 seconds above, not one.
- **`toRoomState` defaults `form` to null, and that is load-bearing.** Every room
  created before this has no field at all, and `undefined` is not `null` — the
  showing condition tests against null (`showTitles` in `App.tsx`), so leaving
  it undefined would read as "the titles are up" in every older room.

### The cards, checked 27 October 2026

PROJ-62. Read against `master` at `b37a605`. The opening titles still do not
start the round: that has been true since `31c04ed` ("Give the quizmaster back
the moment the quiz starts"). A round against Mr Fries is the exception on
*his* card only, and only after the titles have been dismissed.

| Card | When | Advances | Earns its place |
|---|---|---|---|
| Tonight's field (`ColdOpen`) | Lobby, after Start the show, when the season has a fact | Quizmaster: **Start the round**. **Back** returns to the lobby. No timer. Everyone else waits. | Yes. The second press is the point. A room with nothing to say skips it and starts on the one press. |
| Against Mr Fries (`ChaserIntro`) | Lobby, before question one, when the round is against him. After the field card if that went up; otherwise on the first press. | Host opens the question 3s after `chaserIntro.at` (`CHASER_INTRO_MS`). Quizmaster can tap **Next question** sooner. Players: "Get ready — question one is coming up". | Yes. Shipped 23 Oct on purpose. This is the only opening card on a timer. The clock starts when the question opens. |
| Round Two… (`Scoreboard`) | Between questions, not after the last | Quizmaster: **Next question** (or Final results / To Share or Shaft). No timer. | Yes. It sits where no clock is running, so it costs no answering time. |
| Share or Shaft | The whole final, not a beat before it | Talk 60s (quizmaster can end it), then the pick clock, then the reveal. **Final results** is a tap. | It is the mode's own screen. It does not come down early. |
| Podium (`Final`) | The round is over | Builds about 4s. A tap, Space or Enter skips. Then it stays until **Another round** or **Second half**. | Yes. |
| A question nobody got / Nobody missed it (`Review`) | Under the rosettes, when this device saw the whole round. One stumper, one sweep: most people, earliest on a tie, at least two answers. | Stays with the podium. | Yes. Title is Greg's, 27 Oct. A thrown-out question is left out. |
| Rosettes (`Awards`) | Same screen: fastest finger, comeback, the only one who knew, boldly wrong. Omitted when nothing was earned, or this device missed part of the round. | Same. | Yes. A thrown-out question earns none of them, and is not banked (27 Oct). |

Commentator lines ("Nobody got that") are captions on the reveal, not these cards.

**Decided, Greg, 27 October 2026.** The stumper card is titled **A question nobody got**. Tonight's field stays tap-only: a vanished host may sit there until the chair is claimed, about 75 seconds, and auto-starting is worse. Rosettes ignore a thrown-out question, the same rule as that card, and `honoursFor` banks from the same set so the season row matches the screen. Round-title cards and Share or Shaft stay the length they are.

**Still open:** a field card whose named people have all left renders nothing, and the lobby's Start the show then deals a fresh round.

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

**27 October 2026.** A question the quizmaster threw out earns no rosette.
`awardsFor` and `honoursFor` take the same skipped indices as the review, so
the screen and the season row agree. The points were already taken back; the
log still held the reveal, and that reveal was what the rosettes were reading.

**21 October 2026.** A typed call that matches nothing is stored as
`optionIndex` 4, one index shared by every no-match. `contrarian` skips that
index (and anything past it). One person typing a wrong phrase does not earn
the rosette, and two people who typed different wrong phrases are not treated
as having picked the same option. [`typed-answers.md`](typed-answers.md).

---
