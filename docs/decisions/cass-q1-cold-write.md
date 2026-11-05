# Question one's cold write

> **Owner: Greg Rothwell. Last updated: 5 November 2026. Budget: 250 lines.**

**Status: investigated, nothing built. Greg to pick a fix.** Follows [`cass-q1.md`](cass-q1.md), which is at its
budget. Read from `quiz-d686e` with the Admin SDK on 5 Nov 2026: all 112 traces in `q1Traces` (22 Oct to 5 Nov, 105 with
a settled answer write) and the `games/` records behind them. Read-only. Stamps are UTC, which is UK time on these dates.

## The short version

- **Item 12 was closed on a coincidence.** The write never got better. Cass's four fast rounds of 27–29 Oct were all
  short lobbies.
- **A slow first write only happens after a long lobby.** Cass every time; anyone else only in SB88, where four of the seven
  who tapped took over 1.5s.
- **On 5 Nov two answers were lost, not one.** Cass's missed the fold by about 0.2s. JR's was refused outright.
- **3s is not enough, and no reveal hold can fix JR's.** A write over 8s is refused whenever it was tapped.
- **Rounds taking longer to start may be part of the same thing.** Time in the room before question one has risen, and that
  is what makes the write cold. Press-to-question time has never been recorded, so that part is unmeasured.

## What the traces show — verified 5 Nov

`write` is `ackMs`. Time in the room is `visibleForMs`, how long the page had been visible when question one arrived.

| Time in the room | Writes | Median | Over 1.5s |
|---|---|---|---|
| Under 80s | 43 | 0.16s | **0** |
| 80s or more | 60 | 0.22s | **10** |

Two traces have no `visibleForMs`, because the page was hidden. Both are fast.

**Cass, by uid, 13 writes:**

| Time in the room | Writes, sorted |
|---|---|
| Under 80s (6) | 0.05, 0.06, 0.07, 0.13, 0.15, 0.24s |
| 80s or more (7) | 2.43, 2.44, 4.68, 4.72, 4.76, 4.78, 6.44s |

Seven of seven against none of six: a one-sided Fisher exact test gives p = 0.0006. The 80s line was read off this data
after the fact, so treat that p as a description rather than a test. The next few rounds are the test.

**Everyone else with 80s or more, leaving out the quizmaster's seat:** 3 of 38 over 1.5s, all three in SB88, and 8 of 38 over
1s. So a long lobby looks necessary but not sufficient. Outside SB88, nobody but Cass has gone over 1.5s.

**The quizmaster's seat is the control.** The seat that saw the reveal first (the host, by inference, because it sees its
own reveal locally) had 15 writes after 80s or more, median 75ms, none over 1s. That seat wrote Start moments earlier, so
its write path was already open. This fits the explanation below without proving it: the host may also be on a better
connection.

**The seconds are on the way in.** SB88's server stamps (`at` in `games/`) less each answer's `elapsedMs`, against
Greg's: Kelly 1.18s, Joe 0.43s, Roberto 3.44s, Steve 3.60s. Each is about 0.1s under that player's `ackMs`. So two separate
instruments agree, and the delay is before the server stamps the write, not on the ack coming back.

**Lobby length moves with it.** Median time in the room, rounds of three or more seats:

| Date | Rooms | Slow writes |
|---|---|---|
| 27–29 Oct | 50–100s | Cass none in the four `read-owed` showed (item 12 closed here); P6MQ below |
| 2 Nov | E3JM 118s | Cass 4.7s |
| 3 Nov | NRMY 152s | Cass 4.8s |
| 4 Nov | FAPM 60s | None, the only fast day that week |
| 5 Nov | SB88 186s | Four of seven writes |

**Why the lobby could matter — the mechanism, part read and part inferred.** The Firestore SDK closes an idle stream after
60s (`IDLE_TIMEOUT_MS`, `@firebase/firestore` 4.8.0, `index.node.cjs.js:22903`; `6e4` at `index.esm2017.js:14890` — read).
A player's only Firestore writes before question one are joining and changing squad. The lobby vote moved to the RTDB in
release-2026-10-28, which took away the one write a voter could make. So the answer is usually the first write in over
60s, and it has to reopen the stream. Slow writes predate 28 Oct, so the vote move is not the cause; it can only have made
this more common.

## What the traces do not show

- **The idle time itself.** `visibleForMs` is a proxy: the trace has no "last write" field.
- **Which part of reopening is slow**: tokens, the handshake, or the office network. Writes cluster near 1.3, 2.4, 3.6 and
  4.7s, which looks more like a timer than network noise. **Placeholder**, with no timer found.
- **Why Cass and not Kelly**, on the same device class. Every trace says `windows`, nearly all `4g`, which is the browser's
  estimate and not the connection.
- **Why SB88 was so much worse than other long lobbies.** There was no deploy: gh-pages was last written on 2 Nov at 13:43,
  and E3JM's slow write is before it.
- **That closing the idle gap fixes it.** Nobody has tried. The earlier objection on 23 Oct, that five other SWNU tabs were
  fast after as long, still stands as "not sufficient" but no longer as "does not explain".

## SB88, 5 Nov 09:48, 15s

Seconds from each device's question arrival. The fold is the host's reveal: `gateMs` 3100 in `games/`, then 64ms to the
vault and 102ms to dispatch, so about 18.1–18.3s.

| Player | Locked | Write | Landed | Result |
|---|---|---|---|---|
| Greg | 3.6 | 0.08 | 3.7 | Counted |
| Kelly | 4.2 | 1.28 | 5.5 | Counted |
| Joe | 5.2 | 0.56 | 5.7 | Counted |
| Roberto | 6.9 | 3.55 | 10.5 | Counted |
| Steve | 7.2 | 3.70 | 10.9 | Counted |
| **Cass** | 11.8 | **6.44** | **18.3** | **Landed, missed the fold** |
| **JR** | 11.8 | **9.00** | **20.8** | **Refused, `permission-denied`** |
| Rach | — | — | — | No tap |

**Cass:** tapped with 3.2s left. The hold ran its full 3s and the fold went without the answer, by about 0.2s or less. Cass
is missing from question one's `answers` in `games/`.

**JR:** `arrivalOk` allows `elapsedMs` ≥ landing − `openedAt` − 8s. 11.8 < 20.7 − 8, so refused. The rule has no phase
check, and nothing else in it depends on the time (`firestore.rules:576`, `:616`). **JR's own screen said nothing, read in
code and not tested:** `report` keys its notice to the room step at the tap (`App.tsx:330`, `:805`), and the room had moved
on, so the notice and its beacon are both skipped. `read-owed` shows no errors for that day, which matches.

## Is the 3s hold enough? No, but it works

Four answers have landed after the gate since the traces began, all since the hold went live:

| Round | Player | Past the gate | Reveal's `gateMs` | Result |
|---|---|---|---|---|
| E3JM, 2 Nov | Cass | 2.70s | 2754 | **Saved by the hold** |
| NRMY, 3 Nov | Cass | 0.95s | 1006 | **Saved by the hold** |
| SB88, 5 Nov | Cass | 3.18s | 3100 | Lost by about 0.2s |
| SB88, 5 Nov | JR | 5.69s | 3100 | Refused |

`gateMs` is written by the host and `ackMs` by the player, and they agree: the hold ended when the answer landed.

- **What 3s covers:** a write that lands within 3s of the gate. A 4.7s write is safe only if tapped at least 1.6s before
  the end; a 6.4s write needs 3.3s. Cass had 3.2s.
- **Longer holds:** 3.5s would have saved Cass on 5 Nov. 5s covers the 4.7–4.8s cluster at any tap. 6.5s covers every write
  Cass has made.
- **The ceiling:** an honestly timed write over 8s is refused at any tap, because landing − `elapsedMs` is the write's own
  time. Only an auto-lock escapes that, being stamped at the full window. Raising the grace weakens the anti-cheat.
- **Cost of a longer hold:** only a lit lamp with no answer makes the room wait. SB88 would have waited the full hold for JR.

**Lock-in made this tighter.** Median write moved from 41% of the window to 59% (p90 79% to 87%): 66 writes before the 29
Oct deploy, 39 after. Later writes leave less room for a slow one, which is why a 15s round has now lost one. The "0 of 22
on 15s" in `cass-q1.md` no longer holds as a guarantee. An auto-lock fires with 2s left, so it needs a write under about 2.1s
or the hold. In E3JM, Cass's "tap 10.0s of 10s" was that auto-lock, sent at 8.1s and landing at 12.8s.

## Rounds taking a long time to start — Greg, 5 Nov

**Measured:** the rise in time in the room, in the table above. That counts everything since the tab opened, including
waiting for people to arrive, so it is not the delay Greg saw.

**Not measured:** Start to question one. No document keeps it: the titles' stamp is cleared at `start` (`reducer.ts:324`).

**In the code, between the press and question one** (`App.tsx:477`, `:693`, `prepare.ts`):

1. Press Start. Fetch the pack, read the question history and pass rates.
2. One `getDoc` per seat for the titles (`loadForm`).
3. Write the titles. **This is the host's first room write since the lobby began, so it is cold too — inference, untimed.**
4. Wait for a second press, on purpose.
5. Mr Fries's 3s card, if on.
6. Write `start`. Everyone waits for that to come back from the server.

If the host's cold write behaves like Cass's, step 3 alone could be seconds of nothing. Worth timing, not worth believing yet.

## Options — Greg to decide

1. **Keep the write stream open in the lobby. Recommended first.** One small write per device every 45s or so while the
   phase is `lobby`. About 30 writes for SB88's three minutes and eight seats. It tests the explanation directly and helps the
   host's Start as well if that is the same cold write. Two ways to do it, neither tried: a new doc per player (rules change,
   through CI), or deleting your own answer doc, which `firestore.rules:639` already allows.
   **Pass:** Cass under 1.5s on three rounds with 80s or more in the room, against 7 of 7 slow now.
2. **Send answers over Firestore Lite**, which has no stream to idle. The reveal has run this way since #71. Bigger, because
   the answer loses its instant local echo, and it may share whatever part is slow. The fallback if 1 fails.
3. **Raise the hold to 5s.** One constant in `src/host/due.ts`. It saves Cass's kind of miss and does not save JR's. Worth
   adding if 1 fails. Not needed alongside it if 1 works.
4. **Tell the player when an answer is refused.** Separate small bug: JR's refusal is invisible on screen and in the beacon.
5. **Time the start.** A press-to-open field on the trace needs a rules change. Only useful if Greg's "long time to start"
   means after pressing Start.

**Free test, no code, tomorrow:** have Cass open the tab under a minute before the round starts. Six of six fast so far.

## How it was measured

`q1Traces` ordered by `at`, names from `games/{gameId}`. Late landing = `tapMs + ackMs`, on the player's own clock from
arrival, so it is good to a few hundred ms. Gate = window + 0.1s. No answer text or question prompt was read out. To rerun:
`npm run read-traces -- --last 200` prints every row; the groupings here were one-off scripts.

**`read-traces -- --name cass` misses a round, and that hid a slow write from item 12's close.** P6MQ, 28 Oct 09:42, has no
`games/` doc, so it shows a uid rather than a name; Cass's 4.68s is that row, 84s into the room. All six seats there read `NOT COUNTED`, including 0.07s writes tapped early, so in a round with
no scored reveal that flag does not mean a miss.
