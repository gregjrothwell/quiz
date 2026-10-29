# `firstMs` — showing when somebody committed

> **Owner: Greg Rothwell. Last updated: 29 October 2026. Budget: 250 lines.**

What was built on 8 September 2026 against the exploit analysed in
[`answer-spam.md`](answer-spam.md), which is where the arithmetic lives and why
every restriction shape was turned down. This file is the change itself.

**Greg's call: expose it, do not restrict it.** Nothing about answering
changes; the reveal says when somebody committed.

## The story

> As a player, I want to see when somebody committed to a lectern before they
> could possibly have read the question, so that guessing early stops being a
> quiet way to win the rank bonus.

## Acceptance criteria

1. `firstMs` rides the answer document and holds the elapsed time of that
   player's **first** pick on that question. Later changes leave it alone.
2. **Absent until a pick is actually changed**, so a first answer is
   byte-identical to what it was before the field existed.
3. It resets per question with no bookkeeping — `liveAnswers` only hands back
   the question in play, so a new question has nothing held.
4. **Four presses inside 200ms all carry it**, though none of them
   round-trips.
5. An answer written by a bundle that predates the field still scores, and
   comes through `liveAnswers` as the exact object it always did.
6. **Scoring is untouched.** Rank and the steal read `elapsedMs` alone.
7. The reveal marks a first touch under `TOO_FAST_TO_READ_MS`, and marks
   nothing else — an ordinary change of mind stays invisible.
8. `firestore.rules` accepts `firstMs` and still refuses what it refused.

## How it holds up, and the two traps it dodged

**`firstMs` is derived from the answer already held, not from screen state.**
Threading a second copy through `QuestionScreen` is exactly how the wager
collected its silent-swallow traps: the keyboard path passes its own arguments
and would have been handed the stale one.

**The document alone was not enough, and this is the part worth reading.** Four
presses inside 200ms do not round-trip, so presses two, three and four each see
the document as it was before press one — and would write nothing, losing the
early touch on *precisely* the input the field exists to catch. `useRoom` keeps
a synchronous ref alongside the document and takes whichever is earlier. The
ref alone would not survive a reload; the document alone cannot be read back in
time. Both, or it is wrong on the only case that matters.

**Nothing is scored**, which is what makes the threshold safe to be wrong
about: it is a display decision, so no honest player can lose a point to it.
`TOO_FAST_TO_READ_MS` is 1,000 against a measured fastest-ever answer of
1.54s — see the evidence below.

## Evidence

- **675 tests** (was 653), typecheck and lint clean. 22 new, including the
  burst, the old-bundle shape, and that a marked answer scores identically to
  an unmarked one at the same time.
- **The drift test was forced red.** Three tests read `firestore.rules` so the
  hand-paste cannot drift from the client. Taking `'firstMs'` back out of the
  `hasOnly` list turned `is in the answer document hasOnly list` from pass to
  fail, and restoring it turned it back — a passing test proves nothing until
  the failing direction has been seen.
- **Rendered and read off the DOM**, gallery fixture `Reveal · somebody guessed
  at the gun`: `Sam 0.1s` and `Alex 0.1s → 5.2s` in `#ff2e4d` at weight 700,
  every honest chip unchanged at `rgb(122,150,188)` weight 600. Alex is the case
  that was invisible before — that chip read `5.2s` and looked like honest play.
- **The specificity claim was forced, not assumed.** Adding `.tile__snap` to
  your own chip took it amber → red and removing it took it back, so a snap of
  your own is marked like everybody else's.

## Not covered

- **`event.repeat` is still unguarded** on the keyboard handler, so a held key
  fires repeatedly. Harmless here — every press after the first is deduped by
  `submitAnswer`, and the first touch is recorded either way — but it is
  hygiene, and it is not done.
- **A crafted client can lie about `firstMs`**, exactly as it can about
  `elapsedMs`. Neither is checkable server-side and neither is scored, so this
  buys a liar nothing; it is not a new threat class.
- **The wager is untouched.** The stake still rides the answer and can still be
  moved after answering, because nothing here makes an answer final.
- **It is a deterrent, not a rule.** The arithmetic in this file is unchanged
  for anybody willing to be seen doing it.

## 29 October 2026: it is not deterring, and the 0ms (PROJ-78)

**Y86U** (General Knowledge, 10s, 7 seats, 15 questions). First touch under 1s:
Alistair 14 times, Bret 11, nobody else at all. Alistair kept 4 of those snaps
(2 right, 2,000 points) and finished 2nd on 7,400. Bret kept 7 (3 right, 3,000)
and finished 4th on 5,400. Joe won on 9,300 without a single snap. So the two
who were seen doing it did it anyway; it did not decide this round. One round
is not a trend: 28 October had Bret at 5 of 15. **Greg to decide** between
keeping the reveal marker and making a pick final, as
[`answer-spam.md`](answer-spam.md#recommendation--the-first-lectern-you-touch-is-your-answer)
sets out. The numbers in that file still stand.

**The 0ms was the clock, not the rules.** One answer in 6,704 kept ever: Bret,
question 13. The face ticks every 100ms and an answer took the last tick's
reading, so a press before the first tick read 0 and every answer read 0–100ms
fast (Bret's others: 113, 202, 227ms). `useQuestionClock` now gives
`elapsedNow()`, read at the press and capped at the window. Ranks between
close answers are now ordered by when people actually pressed.
