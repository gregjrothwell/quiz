# Rivals — who you've beaten, and who you've lost to

> **Owner: Greg Rothwell. Last updated: 27 October 2026. Budget: 250 lines.**

**Status: built 27 October 2026, not live.** PROJ-64, v1 only. Greg scoped it
that evening: the season caption now, the giant-killer bonus later.

The next phase makes the show about the people in the room
([`direction-oct-2026.md`](direction-oct-2026.md)). This is the first line that
is about one other person, by name, across the season.

## What it says

On the season table, above the rows, for the player looking — and again under
the podium, once that device has banked. Nobody else's line is shown.

| The season so far | The line |
|---|---|
| Ahead of Sam four times, behind Priya three | You’ve beaten Sam most this season — 4 times, and lost to Priya most — 3 times. |
| Ahead of Sam once, and that is all | You’ve beaten Sam most this season. |
| Sam and Alex tied on four | You’ve beaten Alex & Sam most this season — 4 times each. |
| Sam leads both lists, 3 and 3 | You and Sam are level this season — 3 each. |
| Sam leads both lists, 4 and 2 | You’ve beaten Sam most this season, and lost to Sam most — 4 and 2. |
| No decisive round, or you played alone | Nothing. An empty caption reads as a fault. |

Names in a tie are sorted, so the sentence does not follow map order. "Once"
does not grow a number; a shared once says "once each".

## What counts

A round you **finished strictly ahead of** is one beaten. Strictly behind is
one lost. A tie is neither, and it does not open a row for someone new. It
does refresh the name of someone already there.

The comparison is the table the room just ranked. An ordinary round and
half-time use the round. **Round two of a double uses the morning**, because
that is the podium — the banked residual is a different number, and ranking
on it would name the wrong person. `nightAgainst` is that choice, and it is
what `recordGame` is handed.

Your own id is not an opponent. An id that cannot be a Firestore map key
(a dot, a slash, anything outside letters, digits, `_` and `-`) is skipped
rather than refusing the whole bank.

## Where it is stored

`rivals` on the season row: a map of playerId to `{ name, beaten, lost }`.
The name is whatever they were called the last time you met, trimmed to 40
characters, so the caption does not need another read.

**The week row does not get the map.** `bankGame` is shared, and `set` would
keep a field it was handed, but `recordGame` only passes the night's
opponents to the season half. A week is not "this season".

**Cap of 40** (`RIVALS_CAP`). Past that, the coldest opponents drop. A leader
is never the coldest, unless more than 40 people are tied for the lead, which
an office season does not do. The same 40 is the rules' `rivals.size()` check.

**The rules do not walk the map.** They check it is a map of at most 40.
Walking it is how the season rule last ran out of expressions
([`finals-history.md`](finals-history.md)), and rules cannot walk a map
anyway (the cannon's key length). A crafted client can put odd values in an
entry. The caption drops an entry it cannot say. The board is already
trusted to its owner, which is the rest of the row.

Optional, so a row from before this and a client one deploy behind still
bank. The new client writes the field on the season half whenever there is
one to write. `hasOnly` refuses that write until CI publishes the rules,
which it does before the site. `check-rules`: **bank a season row carrying
rivals** FAILs until then and PASSes after. Two denies: more than 40, and a
list. The regular's full row carries a map too, so the expression budget is
judged with the field on it.

`foldRecords` adds the counts when a recovery code is claimed, and keeps the
name from the side that played more recently. `setSquad` copies the document
it read, so changing squad does not clear the map.

## What it does not do

- **No backfill.** The caption starts from the next round this client banks.
  `games/` could rebuild it; that is a later job, the way finals were.
- **No giant-killer bonus.** That is a scoring change and wants a measurement
  first. Not this.
- **No Higher or Lower streak.** The streak is still a scoring change. The
  line above is where one could be said later
  ([`higher-or-lower.md`](higher-or-lower.md)).
- **An old bundle erases the map.** Both writers use `set`. A device still on
  the previous bundle banks a row that does not name `rivals`, and the next
  game clears it. Same trap as the rosettes. It lasts as long as the old
  bundle does.

## Where it lives

`src/engine/rivals.ts` is the counts, the cap, the night, and the sentence.
`bankGame` carries the map. The season table renders it for your row
(`LeagueBoard`); the podium renders the sentence `recordGame` returns, which
costs no extra read.
