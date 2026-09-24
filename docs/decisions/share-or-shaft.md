# The Split or Steal final

> **Owner: Greg Rothwell. Last updated: 24 September 2026. Budget: 250 lines.**

**Status: story and acceptance criteria, for Greg's approval. Nothing is
built.** The round ends as it does now; then, in a room that opted in, the top
two play Split or Steal for both their scores while everybody else watches.

Taken from *Shafted* (ITV, 2001, Robert Kilroy-Silk — "Share or Shaft") and
*Golden Balls* (ITV, 2007–09, Jasper Carrott — "Split or Steal"). Both shows end
on the same dilemma, and the dilemma is the only part taken.

## Greg's calls, 24 September 2026

| Question | Call |
|---|---|
| A game mode, or an option like the wager? | **An option** — a lobby toggle, any pack |
| What is at stake? | **Both finalists' whole scores**, not a bonus on top |
| Who plays? | **The top two.** If that goes stale, the leader picks who they trust |
| Does it count? | **Yes — it banks to the season** |

**Why an option.** A mode is for rules that change how the questions are
played; an option is for something bolted around them, and the final only
happens after the last question. Everything in the two shows that would force
a mode is in their middles — voting people off, bluffing about hidden balls,
bidding on half a question — and none of it is taken (see *Not built*).

**Why the whole score.** With a bonus pot, both stealing is a shrug: nothing
happens. With the whole score it is the biggest moment of the round — third
place wins — and "split" literally means sharing the win.

**Why it banks.** If it costs nothing, stealing is free and there is no dilemma.

## The rules

1. **A lobby toggle**, off by default, with every pack. It stacks with the
   wager and steal — the wager resolves on the last question first, so it
   decides who reaches the final.
2. After the last question's scoreboard, the **top two** current members go to
   the final. Nobody else's score moves.
3. The **pot** is what each finalist holds above zero, added together.
4. **Talk: 60 seconds**, out loud on the call. No chat in the app.
5. **Pick: 15 seconds**, blind. One tap, locked.
6. Both split: half each, level — joint winners. One steals: all of it, and the
   other drops to 0. Both steal: both drop to 0.
7. **No pick counts as Split.**

`NA9N`, 24 September, played that way — first on 26,700, second on 22,600,
third on 21,400, so a pot of 49,300:

| | Second splits | Second steals |
|---|---|---|
| **First splits** | 24,650 each, joint first | Second 49,300 · first 0 |
| **First steals** | First 49,300 · second 0 | Both 0 — third wins on 21,400 |

TV finalists meet once. This office plays most mornings, so reputations carry
into tomorrow's final — which is the thing the office version has that the
original never could.

## Story

> As a player in a room that switched it on, I want the round to end with the
> top two deciding — out loud, then in secret — whether to share everything they
> scored or try to take it all, so the round ends on a moment the whole room
> watches together.

## Acceptance criteria

1. **Opt-in.** The lobby offers the final beside the wager and steal toggles,
   off by default, with every pack. Off, a round ends exactly as it does today.
2. **Finalists.** The top two of `roomStandings` — current members only. A tie
   at the cut is broken by a coin seeded from `gameId`, as `jigsawRng` seeds the
   scramble: identical on every device, and not the same person every time,
   which the board's own uid order would be. Fewer than two members: no final.
3. **Pot.** Each finalist stakes their score above zero; a negative score stays
   with its owner. Nobody else's score moves.
4. **Talk.** 60 seconds on the room clock, on every screen, with both names,
   both scores and the pot. The quizmaster can end it early.
5. **Pick.** 15 seconds on the room clock. Each finalist gets Split and Steal,
   by tap or by key, and the first pick locks. Everybody sees *locked in* for
   each finalist — never the pick.
6. **Sealed.** Until both picks are locked, no document any client can read
   holds either one. What a finalist writes on tapping is a commitment only,
   checked by a test on the written payload.
7. **Outcome.** Both split: `floor(pot / 2)` each — an odd point is dropped so
   they stay level. One steals: the pot to the stealer, 0 to the other. Both
   steal: 0 each. No pick, or a reveal that fails its check, counts as Split. A
   pure engine function of the scores and the picks, identical on every device
   ([`scoring.md`](scoring.md) AC#6).
8. **Reveal.** Both picks turn over at the same moment, and every screen says
   what happened in words — including to the player it happened to: *"Priya
   stole 49,300. You leave with nothing."*
9. **Season.** The banked score is the post-final score, both joint winners
   bank a win, and a stolen pot is never refused at the bank.
10. **Kept.** The round's record in `games/` holds the finalists, their picks
    and the pot, and `read-games` prints them. "Stale" is then a query rather
    than a feeling.
11. **Leaving.** A finalist who leaves or drops keeps whatever they locked.
    *Another round* in the same room starts clean.
12. **Clean-up.** `prune-rooms` deletes the final's documents with the room.

## The sealed pick — the one new piece of engineering

**Why it is needed.** Every client can read every answer before the reveal,
accepted on purpose (`firestore.rules:378`). The wager rides the answer
document, and seeing somebody's stake early is harmless. Seeing a pick early is
the whole game: whoever picks second reads the first.

**Recommended: commit, then reveal.** Tapping writes
`sha256(pick, nonce, gameId, uid)` to a new `rooms/{code}/standoff/{uid}`. Once
both commitments exist, each finalist's device writes its pick and nonce, and
every client checks the hash. The uid and `gameId` are inside the hash, so a
commitment cannot be copied from the other finalist or replayed from another
round. The logic lives in the engine, where `npm test` reaches it; the rules
only bound fields — owner-only, commitment fixed within a game, pick one of two
words. No `get()`, no gate.

**Withholding never pays.** A missing reveal counts as Split, and Steal is never
worse than Split for the person choosing it — so holding a reveal back can only
help the other finalist. The same rule covers a dropped connection, or a nonce
lost to a reload.

**The alternative** is a rule that opens pick documents only once both exist:
one write each and no nonce, but correctness then lives in a hand-pasted ruleset
with a `get()` — the shape of #56
([postmortem](postmortem-the-pin-that-refused-the-reveal.md)).

## Places that would swallow it in silence

The wager found five ([`wager.md`](wager.md)). This one has these:

1. **The phase list.** `wellFormed()` allows five phases (`firestore.rules:321`)
   and `App.tsx` matches phases exhaustively. The new one wants a name other
   than *finale*, which is already the podium's class (`seat.ts`); *standoff* is
   the working one.
2. **The kept round.** `games/` takes an exact key list (`firestore.rules:631`),
   so an unlisted key refuses the whole record. The new key goes in `hasOnly`
   and **not** `hasAll` — `hasAll` would refuse every record from a bundle that
   predates it.
3. **The season cap.** `maxBest()` is 100,000 a game (`firestore.rules:703`). A
   stolen pot can pass it in a long round, and the bank write would then be
   refused — the stealer's night lost. The paste raises it.
4. **`prune-rooms`** names its subcollections by hand
   (`scripts/prune-rooms.ts:41`), so a new one would be orphaned forever.
5. **The keyboard path** — the wager's fourth.
6. **The loser's screen** — the wager's fifth.
7. **A stale bundle.** A player still on the old build sees an empty screen
   during the final. Deploy window only, and the toggle is off by default.

**Already right, checked.** Banking reads the snapshot taken at `finished`
(`useFinalSnapshot.ts:135`), so a final that sits before `finished` banks
post-final scores with no change there. `standings` gives equal scores the same
position (`scoring.ts:308`), so joint winners both bank a win. The room document
has no top-level key list, so its new fields need no paste — only the phase does.

## Evidence it will need

Per `EVIDENCE.md` — verified, not "should work":

- `npm run typecheck && npm run lint && npm test`, with engine tests for all
  four cells, no pick, a bad reveal, an odd pot, a negative score, a tie at the
  cut and a room of one.
- `check-rules` **allow** cases, each FAIL before the paste and PASS after: a
  commitment, its reveal, a fresh commitment in a reused room, a room in the new
  phase, a kept round with the new key, a banked game above 100,000. Deny cases:
  another uid's document, a changed commitment, a third word.
- The client's own path end to end: a harness plays a round to `finished`
  through the final twice — both split, then one steal — and reads the banked
  rows back.
- `sync-harness 10` after the paste, because it touches the room document.
- One live round with the toggle on before calling it done.

**Not covered, deliberately:** whether the office likes it. That is the live
round.

## Not built, and why

- **Hidden balls and bluffing** (Golden Balls). Needs a deal nobody can peek at;
  without a server, the obvious dealer — the quizmaster's device — sees every
  ball.
- **Voting someone off, the leader shafting someone out, the greediest bid
  knocked out** (both). Elimination. The wager and steal were built to keep the
  bottom of the table *in*.
- **Betting on half a question** (Shafted). Close to the every-round wager held
  back in [`wager.md`](wager.md).
- **Bin or Win, killer balls** (Golden Balls). Later, if the final lands.
- **The leader picks their opponent.** The planned switch if top-two goes stale.
  Shafted's leader chose who to shaft out; this turns it round.
- **A whole-room jackpot.** Everybody picks; the splitters share it unless
  somebody steals; one stealer takes it, two or more and it is gone. Keeps
  everyone playing, loses the one-on-one.
- **A bonus pot, and not banking.** Both turned down by Greg, 24 September — the
  reasons are above.

## Open

| Decision | Owner |
|---|---|
| The lobby's name: *Split or Steal* or *Share or Shaft* | Greg |
| Commit–reveal for the sealed pick, or the rule gate | Greg |
| When top-two counts as stale | Greg, from `read-games` |
| 60 s to talk and 15 s to pick — revisit after one live round | Greg |

## Where the decisions came from

**The live record** — a one-off Admin SDK read of `games/`, 24 September 2026
(the last 25 asked for; 17 exist):

- One player would have been in **12 of 17** finals, and won 10 of the rounds
  outright. That is why "switch if stale" is written down now.
- The median gap between first and second is **2,100**. The largest pot would
  have been **49,300** (`NA9N`).
- The wager was on in the **last seven rounds running**; steal in **2 of 17**.
  One moment at the end is what the office keeps switching on.
- **14 of 17** rounds are stamped between 08:29 and 09:23. A 90-second final fits
  that slot; rounds of voting would not.

**The shows**, fetched 24 September 2026:

- *Shafted* — ITV, 5–26 November 2001, Robert Kilroy-Silk; pulled after four
  episodes. A greed round, bidding on half a question, the leader shafting a
  player out, then Share or Shaft.
  [Wikipedia](https://en.wikipedia.org/wiki/Shafted) ·
  [UKGameshows](https://www.ukgameshows.com/ukgs/Shafted)
- *Golden Balls* — ITV, 18 June 2007 to 18 December 2009, Jasper Carrott; six
  series, 289 episodes. Hidden balls, votes off, Bin or Win, then Split or
  Steal. [Wikipedia](https://en.wikipedia.org/wiki/Golden_Balls)
- Both finals pay the same: both share, half each; one takes, all of it; both
  take, nothing.
