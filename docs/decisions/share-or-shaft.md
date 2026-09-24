# Share or Shaft — the final

> **Owner: Greg Rothwell. Last updated: 24 September 2026. Budget: 250 lines.**

**Status: built on branch `share-or-shaft`, not merged, not deployed, and the
rules are not pasted.** Paste first — see *Before it deploys*. After the last
question, in a room that opted in, the top two play for both their scores while
everybody else watches.

Taken from *Shafted* (ITV, 2001, Robert Kilroy-Silk) and *Golden Balls* (ITV,
2007–09, Jasper Carrott, "Split or Steal"). Both end on the same dilemma, and
the dilemma is the only part taken.

## Greg's calls, 24 September 2026

| Question | Call |
|---|---|
| A game mode, or an option like the wager? | **An option** — a lobby toggle, any pack |
| What is at stake? | **Both finalists' whole scores**, not a bonus on top |
| Who plays? | **The top two.** If that goes stale, the leader picks who they trust |
| Does it count? | **Yes — it banks to the season** |
| The name | **Share or Shaft** — the words on the buttons too |
| Keeping a pick secret | **Commit, then reveal** — not a rule that gates the read |

**Why an option.** A mode is for rules that change how the questions are
played; an option is for something bolted around them, and the final only
happens after the last question. What would force a mode is the middle of the
two shows — voting people off, bluffing, bidding — and none of it is taken.

**Why the whole score.** With a bonus pot, both shafting is a shrug. With the
whole score it is the biggest moment of the round — third place wins — and
"share" literally means sharing the win. **Why it banks:** if it costs nothing,
shafting is free and there is no dilemma.

## The rules

1. **A lobby choice**, *How it ends*, off by default, with every pack. It stacks
   with the wager, which settles first and so decides who reaches the final.
2. After the last scoreboard the **top two** current members go through. A tie
   at the cut goes to a coin seeded from the game — the board's own tie-break
   is uid order, which would hand every tie to the same person all season.
3. The **pot** is each finalist's score above zero. A negative score stays with
   its owner. Nobody else's score moves.
4. **Talk: 60 seconds**, out loud on the call. The quizmaster can end it early.
5. **Pick: 15 seconds**, blind. One tap or key (1 share, 2 shaft), locked.
6. **The whistle**: when both have picked, or the clock and a 3-second grace
   run out. Only a pick committed by then can count.
7. Both share: `floor(pot / 2)` each, level — joint winners. One shafts: all of
   it, the other to 0. Both shaft: both to 0. **No pick counts as share.**

`NA9N`, 24 September, played that way — first 26,700, second 22,600, third
21,400, a pot of 49,300:

| | Second shares | Second shafts |
|---|---|---|
| **First shares** | 24,650 each, joint first | Second 49,300 · first 0 |
| **First shafts** | First 49,300 · second 0 | Both 0 — third wins on 21,400 |

TV finalists meet once; this office plays most mornings, so reputations carry
into tomorrow's final.

## Story

> As a player in a room that switched it on, I want the round to end with the
> top two deciding — out loud, then in secret — whether to share everything they
> scored or try to take it all, so the round ends on a moment the whole room
> watches together.

## Acceptance criteria, and where each stands

1. **Opt-in**, off by default; off, a round ends exactly as today. *Met — lobby,
   reducer tests.*
2. **Finalists**: top two members, seeded coin at the cut, none under two
   members. *Met — `standoff.test.ts`.*
3. **Pot**: stakes above zero; nobody else moves. *Met — tests.*
4. **Talk**, 60 seconds; the quizmaster can end it. *Met — see the clock note.*
5. **Pick**, 15 seconds, tap or key, first pick locks, others see only *locked
   in*. *Met — gallery fixtures at desktop and phone width.*
6. **Sealed**: no readable document holds a pick before the whistle. *Met — the
   commitment payload is tested to hold no pick; `final-harness` prints both
   live commitments once the paste lands.*
7. **Outcome** as the table; no pick or a failed reveal counts as share; a pure
   engine function. *Met — the four cells, the edges, withholding never pays.*
8. **Reveal**: both turn over at once, said in words to whoever it happened to.
   *Met — `standoffWords.test.ts`; the table itself shows gains only, which is
   the whole app's existing behaviour and was left alone.*
9. **Season**: banks the post-final score; joint winners both win; a big pot is
   never refused. *Met in code — banking reads the snapshot at `finished`
   (`useFinalSnapshot.ts:135`), `standings` shares a position on equal scores,
   and `maxBest()` rises to 200,000. The last needs the paste.*
10. **Kept**: finalists, picks and stakes in `games/`; `read-games` prints each
    final and a count of who keeps reaching one. *Met — tests.*
11. **Leaving**: a finalist keeps what they locked; *Another round* starts
    clean. *Met — reducer tests.*
12. **Clean-up**: `prune-rooms` sweeps `standoff`. *Met.*

**Changed while building — the clocks.** AC 4 and 5 first said *on the room
clock*. They count on each screen from when it saw the stage open, the question
clock's own fallback. Nothing is scored on them; the quizmaster's device moves
the stages and is the only clock that decides anything.

## How the sealed pick works

Every client can read every document in a room (`firestore.rules`, answers).
Seeing a stake early is harmless; seeing a pick early is the whole game.

1. Tapping writes `sha256(pick, nonce, gameId, uid)` to
   `rooms/{code}/standoff/{uid}`, and the pick and nonce to session storage.
2. The quizmaster's device blows the whistle — `closed`, with `sealed` naming
   who had committed.
3. Each sealed finalist's device then writes its pick and nonce.
4. The quizmaster's device opens both with `openedPick` and settles.

The engine decides what counts (`sealedPick.ts`, `standoff.ts`, tested). The
rules bound fields and pin the commitment: owner only, `gameId` must be the
room's own, a commitment cannot change within a game, a pick is one of two
words, and a pick cannot be deleted while a final is on.

**Two holes found while building, both closed.**

- *Hopping games.* "Another round" reuses the room, so a new `gameId` has to be
  able to replace last round's commitment. If any `gameId` could, a finalist
  could hop to a made-up one and back to re-commit after reading a reveal. The
  rule pins `gameId` to the room's — one `get()` per pick write.
- *Revealing on both commitments.* The first design revealed once both were in,
  which strands a finalist whose opponent never picks; revealing on a timer
  instead lets a late opponent read and then commit. The whistle fixes both,
  and the engine drops any pick not sealed by it, whatever it is passed.

Deleting a pick is allowed only outside a final, for the same reason: delete
and re-create mid-final is a re-commit.

## Places that would swallow it in silence

| Trap | Handled |
|---|---|
| The phase list is an exact allow-list; `App.tsx` matches phases | `standoff` added; `standoff.test.ts` fails if the rules and `PHASES` differ |
| `games/` requires every key (`hasAll`), so a new key refuses old bundles' records | Rides inside each finalist's player entry — no key added |
| `maxBest()` was 100,000; a stolen pot can pass it | 200,000, with a `check-rules` allow case |
| `prune-rooms` names its subcollections by hand | `standoff` added |
| The keyboard path (the wager's fourth) | 1 and 2 pick; space moves the quizmaster on |
| The loser's screen (the wager's fifth) | The headline names who did it and what went |
| A player on the old bundle during the final | Sees "Out of step" with Reload. Deploy window only; off by default |

## Evidence

- `npm run typecheck`, `lint`, `build`, `check-bundle` clean; `npm test` green
  (numbers in the commit).
- Gallery (`#/preview`, fixtures 20–24), on a fresh dev server — the long-running
  one on 5273 served a stale `Preview.tsx` and was not trusted. Desktop and
  375px: no sideways scroll, seats side by side. It caught the table squeezed
  to its content by the centring; fixed.
- `check-rules` **before the paste: 86 PASS, 5 FAIL**, the five being exactly
  the new allow cases (open the final, commit, reveal, sweep, bank above
  100,000). The new denies pass vacuously until the block is published.
- `final-harness` **before the paste**: created `DFY4`, played the question,
  revealed from the vault, and was refused on the write into the final — the
  phase — which is the right refusal.

**Not yet covered.** The allow direction on the published rules (needs the
paste). The React hook's own path end to end: the Playwright e2e needs JDK 21,
which this machine does not have, and the live browser path waits on the paste.
And whether the office likes it — that is the live round.

## Before it deploys

1. Paste `firestore.rules` (phase, `standoff/{uid}`, `maxBest()`).
2. `npm run check-rules` — **91/91**, the five allow cases FAIL → PASS.
3. `npm run final-harness` — the final paid 1,900 / 0 / 0 and the three
   re-commit attempts refused, read back from the server.
4. `npm run sync-harness 10` — it touches the room document.
5. A real two-browser round through the final, then deploy.

## Known limits

- A reload restarts that screen's stage clock; on the quizmaster's device that
  lengthens the stage. A quizmaster handover mid-stage does the same.
- Two devices briefly both believing they are quizmaster could each close the
  picks. The reducer refuses a second close on a device that saw the first.
- The talk and pick lengths (60 s, 15 s) are guesses. Greg, after one round.

## Not built, and why

- **Hidden balls, bluffing** (Golden Balls): needs a deal nobody can peek at;
  without a server the quizmaster's device would see every ball.
- **Voting off, the leader shafting someone out, the greediest bid out**:
  elimination. The wager and steal exist to keep the bottom of the table in.
- **Betting on half a question** (Shafted): the every-round wager held back in
  [`wager.md`](wager.md). **Bin or Win, killer balls**: later, if this lands.
- **The leader picks their opponent**: the planned switch if top-two goes
  stale. Shafted's leader chose who to shaft out; this turns it round.
- **A whole-room jackpot**: everyone plays, the one-on-one is lost.
- **A bonus pot, not banking**: turned down by Greg, 24 September.

## Open

| Decision | Owner |
|---|---|
| When top-two counts as stale — `read-games` prints the count | Greg |
| The talk and pick lengths, after one live round | Greg |

## Where the decisions came from

**The live record** — a one-off Admin SDK read of `games/`, 24 September 2026
(17 rounds): one player would have been in **12 of 17** finals and won 10
outright, which is why "switch if stale" is written down now. Median gap first
to second **2,100**; largest pot **49,300** (`NA9N`). The wager was on in the
**last seven rounds running**, steal in **2 of 17**. **14 of 17** rounds are
stamped 08:29–09:23: a 90-second final fits; voting rounds would not.

**The shows**, fetched 24 September 2026: *Shafted*, ITV, 5–26 November 2001,
pulled after four episodes — a greed round, bidding on half a question, the
leader shafting a player out, then Share or Shaft
([Wikipedia](https://en.wikipedia.org/wiki/Shafted) ·
[UKGameshows](https://www.ukgameshows.com/ukgs/Shafted)). *Golden Balls*, ITV,
18 June 2007 to 18 December 2009, six series, 289 episodes — hidden balls,
votes off, Bin or Win, then Split or Steal
([Wikipedia](https://en.wikipedia.org/wiki/Golden_Balls)). Both finals pay the
same: both share, half each; one takes, all of it; both take, nothing.
