# `firstMs` — showing when somebody committed

> **Owner: Greg Rothwell. Last updated: 8 September 2026. Budget: 250 lines.**

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
- **A crafted client can lie about `firstMs`.** `elapsedMs` now has an arrival
  floor ([`answer-window.md`](answer-window.md)); `firstMs` does not, because
  flooring it would refuse an honest change of mind after grace — which is
  making picks final, which was turned down. Neither is scored, so a tiny
  `firstMs` on a late change buys a liar nothing on the board.
- **The wager is untouched.** The stake still rides the answer and can still be
  moved after answering, because nothing here makes an answer final.
- **It is a deterrent, not a rule.** The arithmetic in this file is unchanged
  for anybody willing to be seen doing it.
