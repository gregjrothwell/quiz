# The end of a round

> **Owner: Greg Rothwell. Last updated: 5 November 2026. Budget: 250 lines.**

**Status: built 5 November 2026, PROJ-116. See the PR for whether it is live.**

Greg, relayed the same day: "The game seems to have got a bit messy with the geekend game type
option - the whole round ending area needs looking at." After the review: "remove geekend - do
what's most logical on the rest and flag if unsure."

## What the review found

**Geekend was not the cause.** It changed which questions were dealt and nothing after the last
one. It looked like a game type because it sat among the options, directly above How it ends. The
mess was older:

1. Three separate lobby controls decided how a round ended, split up by unrelated ones.
2. The end screens were built one mode at a time, so half-time and post-final replayed the ceremony.
3. Lobby choices did not survive to the next round.

## What was decided

| Decision | Who | Why |
|---|---|---|
| Geekend's option and separate question list go. The squad stays | Greg, "remove geekend" | Read live 5 Nov: `season-2-geekend/asked` empty, 0 of 31 season rows in the squad. W4 tenancy in [`public-scale.md`](public-scale.md) is the real answer to a separate group |
| Stakes and Share or Shaft are one picker | Claude, on Greg's "most logical" | 75 real rounds (5+ questions, 2+ seats, since 9 Sep): stakes 32, final 26, neither 17, both 0 |
| No last scoreboard when no final follows | Same | A table with the winner on top, one press before the drum roll, left the podium nothing to hide |
| The table stays before a final | Same | It is who is about to play, and for how much |
| Half-time is bare | Same | Nobody has won. Still banks. Keep or Bin stays, only if there is something to ask |
| No second drum roll after a final; fanfare and confetti stay | Same | The final acted the result out. The podium still crowns it |
| One table below the podium | Same | A double's table replaces the standings; they had the same order |
| A question is a question, a round is a game, The Double has halves | Same | "Round Two" meant a question and half a double (raised in [`morning-double.md`](morning-double.md), 24 Oct) |
| **The week board stays on the final screen** | Claude, against the review's own recommendation | It answers a different question from the table above it, and [`season.md`](season.md) lists it as a feature. Pinning the host's button removed the cost. **For Greg to overrule** |

## How it works now

- **The next lobby starts from the last round.** Modes and the clock are read off the room, so they
  survive a reload or a change of host. Length and level are this device's (`lastDeal` in `App.tsx`):
  they only save taps, and putting them on the room would change every host write for little. Not
  carried: the pack, The Double, the jigsaw, the Slop Cannon. Survey Says carries nothing about length.
- **`finalistsAfterLast` (`src/engine/double.ts`) is the one answer** to "does a final follow?". The
  reducer and each button read it, so a button cannot promise a final that will not play. It did:
  the first half with Share or Shaft on said "To Share or Shaft" and went to half-time.
- **`next` from the last reveal** goes to `finished` when no final follows, else to `scoreboard`. A
  thrown-out last question still lands on `scoreboard`, whose button then goes to the results.
- **No rules change.** `firestore.rules` names no phase transition: `wellFormed` only lists the phases,
  and its comment says why a reveal is not narrowed to one (read 5 Nov). Proved through the emulator
  by `e2e/round-end.spec.ts` and every spec that plays to `finished`.
- **The season table closes itself** when the room moves on from the game it was opened on
  (`seasonFrom` in `App.tsx`).

## Not covered

- **`rank-harness` was changed and not run.** It writes to the live project. It now expects one
  `next` from the reveal to `finished`.
- **First half's question count is not on the room**, so the card for The Double prints no count
  rather than the second half's alone.
- **The Double's stakes** play on each half's last question, as they always did. The lobby now says so.
- **Mr Fries's usage is unknown before 26 Oct**: `chaserEnabled` is not on the kept round.
