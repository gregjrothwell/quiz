# The tie-break for a place in the final

> **Owner: Greg Rothwell. Last updated: 6 November 2026. Budget: 250 lines.**

**Status: built on `fix/final-coin-line` (PROJ-117, #197), not merged, not live.**
Rule 2 of [`share-or-shaft.md`](share-or-shaft.md).

Greg asked if a coin was the best way to settle a tie, and chose this over a
sudden-death question and a closest-number round. The coin had decided **5 of 29
finals**. Re-run on those five (a question that scored counts as right): the count
settled 4, speed the other, and 2 results would have changed. Five is too few to
call it fairer.

The count is `rightAnswers` on the room (`rightAnswers.ts`), one `{right, ms}` a
player, written in the reveal and taken back by a skip. It has to be on the room:
`lastPicks` holds one question, and the per-question log is per device, so one that
reloaded could reach a different finalist. `ms` is over right answers only. A Survey
Says tell counts nothing. A bonus question counts as one. No rules change:
`wellFormed` does not list the room's keys, and only the host writes this one.

## Evidence

`e2e/node-round.spec.ts` plays a real tied round on the emulators: Bo and Cy tie on
5,000, Bo with 6 right, Cy with 5 but faster, on a game id whose coin would pick Cy.
With the count taken out of `finalistsAfterLast` it fails on the finalist, Cy for Bo;
with it in, it passes. The scores and the count passed in both runs, so that failure
is the tie-break's alone.

## Not covered

Answering is by Node clients, so no browser has played a tie; the line is proved by
`ShareOrShaft.tie.test.tsx` and the gallery. No live tied round has played this. The
first tied final in `read-games` is the check: its finalist should have the higher
count.
