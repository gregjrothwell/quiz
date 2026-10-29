# Rivals — who you've beaten, and who you've lost to

> **Owner: Greg Rothwell. Last updated: 29 October 2026. Budget: 250 lines.**

**Status: built 27 October 2026, not live.** PROJ-64, v1 only. Greg scoped the
caption that evening, and asked for the history the same day. The backfill is
a dry run until `--go`, and it has not been run. The giant-killer bonus is
later.

The next phase makes the show about the people in the room
([`direction-oct-2026.md`](direction-oct-2026.md)). This is the first line that
is about one other person, by name, across the season.

## What it says

On the season table, above the rows, for the player looking — and again under
the podium, once that device has banked. Nobody else's line is shown.

| The season so far | The line |
|---|---|
| Ahead of Sam four times, behind Priya three | You’ve beaten Sam most this season — 4 times, and lost to Priya most — 3 times. |
| Ahead of Sam once, and that is all | Nothing (PROJ-80, below). |
| Sam and Alex tied on four | You’ve beaten Alex & Sam most this season — 4 times each. |
| Sam leads both lists, 3 and 3 | You and Sam are level this season — 3 each. |
| Sam leads both lists, 4 and 2 | You’ve beaten Sam most this season, and lost to Sam most — 4 and 2. |
| No decisive round, or you played alone | Nothing. An empty caption reads as a fault. |

Names in a tie are sorted, so the sentence does not follow map order.

**A clause needs a lead of at least 2, held by at most three people** (PROJ-80,
29 October 2026). It started at two; Greg said three is fine, so Joe's "lost to
Greg & Kelly & Rach — 9 times each" stays. No "and N others": which names it
showed would be alphabetical. Otherwise that clause goes and the other stands
alone. Measured on live season-2 that day: 25 rows with rivals, 20 keep a
caption; every caption that changes loses a "once each" list, up to nine names
long, and nothing else.

## What counts

A round you **finished strictly ahead of** is one beaten. Strictly behind is
one lost. A tie is neither, and it does not open a row for someone new. It
does refresh the name of someone already there.

**A seat is not a game played.** Joining seeds a score of 0, so someone who
joined and never answered is nobody's opponent (`tookPart`): it takes an
answer in the round, or a total that is not 0, the morning of a double seen
from round two. The bank reads answers off this device's log, and the
backfill reads them off `games/{id}.questions` (PROJ-64 review, 28 Oct 2026).

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

## Backfill

`npm run backfill-rivals` replays `games/` onto `season-2` rows. Dry run until
`--go`, the same shape as `backfill-finals`. It is not part of the bank: the
rules set `games/` read to false, so a client cannot see the history.

Run it **after** the deploy, and again a few days later. Both writers use
`set`, so a phone still on the previous bundle erases its own map at the next
bank. Admin writes bypass the rules. The rules still have to be published
before the new client, which CI does, or that client's bank is refused.

It files each uid under `claims/{uid}.playerId` when that claim exists, and
the opponent keys the same way, so one person is not split across the uid row
and the row they play as now. It does not create a season row, and it does
not touch a week row or anything but `rivals`.

**Test rounds are skipped** (`testRunOf`, 28 October 2026): a harness game id
(`rank-`, `final-`, `host-`, `harness-game`), or a table where every name has
"test" in it. One real name keeps the round. The first `--go` that day wrote
24 rows; with the 11 test rounds in, `G TEST` would have had a line.

Counts take the max of the row and the replay. They are not added, so a
second run does not double a round, and a meeting the record does not have is
left in place. The name follows whichever side has met them more.

**What it cannot recover.** `games/` starts 8 September 2026. Season-2 started
3 August, and those earlier rounds are not in the caption. A record the
quizmaster's device failed to write is the same gap. `recent` cannot fill it:
it stores your score, not the table. Round two of a double whose first half
is missing is skipped, rather than ranked on the residual. The dry run prints
`played` against how many kept rounds it could see.

## What it does not do

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
costs no extra read. `scripts/rivals-backfill.ts` is the replay;
`npm run backfill-rivals` writes it.
