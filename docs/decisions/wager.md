# The wager

> **Owner: Greg Rothwell. Last updated: 2 September 2026. Budget: 250 lines.**

`ideas-review.md` §3, built. One question — the last — where you stake a share of
your points, so the bottom of the table is still mathematically alive at question
fifteen.

## It had never been built

Worth recording, because the session started from the opposite belief. Greg
pitched the idea verbally at the round of 1 September and the office liked it;
someone then suggested betting every round. **No wager had ever existed in the
app** — no code, no branch, no commit on any ref, and nothing treating the last
question differently beyond a "Final results" label. The enthusiasm was for a
pitch, which is a good reason to build it and a bad reason to widen it.

Greg's call: **final question only for now, while we find out how it plays.**

## A share, not a number of points

The load-bearing decision, and it is about the ruleset rather than the game.

A stake is a percentage of what the player already holds — nothing, a quarter,
half, or all of it. You cannot stake what you do not have, so:

- a game total can never go negative, leaving `points >= 0` untouched
  (`firestore.rules`, the season row);
- a fifteen-question round tops out near 30,000 against `maxBest()` of 100,000,
  leaving `best <= maxBest()` untouched.

An **absolute** stake breaks both and costs a second ruleset paste. This costs
one: `'wager'` into the answers `hasOnly` list, plus `is int` and a 0-100 bound.

## Cost: nothing

Zero additional reads and zero additional writes. The stake rides the answer
`setDoc` that was happening anyway, and the answers listener already delivers the
whole document to every client. `wagerEnabled` goes on the room document and is
set by the `selectPack` dispatch that was happening anyway — and needs no paste,
because `wellFormed()` bounds the fields it names and does not `hasOnly` the
document's keys. The same reason `expiresAt` needed none.

The only new write in the game is a player changing their stake after answering.

## Which question it belongs to is decided in the engine

The ruleset bounds the *value* of `wager` and says nothing about *which question*
it is for — checking that would need a `get()` on the room for every answer write.
So `isWagerQuestion` decides instead: the last question, and only in a round the
room opted into. A stake sent on any other question is dropped by the reducer and
ignored by the tally, identically on every device.

This keeps the reveal a pure function of what every client already holds, which
is `scoring.md` AC#6 and non-negotiable — `tallyQuestion` takes `scores` only on
the question actually being played for stakes.

## Five places that would have swallowed it in silence

Every one fails quietly. They are listed because that is the shape of this
feature's risk, not because they were hard.

1. **`firestore.rules`** — `hasOnly` is an exact allow-list, so an unlisted
   `wager` refuses *the whole answer write* and the player scores nothing.
2. **`useRoom.submitAnswer`** — the dedupe guard compared `optionIndex` only, so
   changing only your stake was dropped. Now compares both.
3. **`liveAnswers`** — rebuilds the answer field by field, so a wager on the
   document never reaches the reducer unless it is named there.
4. **The keyboard path** — `onAnswer(pick)` in the `a`–`d` handler carried no
   stake. Answering with a key is the fastest way to play, so this would have
   lost the bet for exactly the players most likely to have placed one.
5. **The reveal** — the delta only ever printed when you got it right. A player
   staking half their score and getting it wrong was told "Wrong" and no number:
   the largest swing in the game, and the only one the screen stayed silent
   about.

## Known limits, deliberately

- **A player on zero stakes nothing**, which is precisely the case §3 exists to
  solve. Left to see whether it happens in a real round.
- **A stake of nothing is left off the answer document**, not written as
  `wager: 0`. It scores identically, keeps the document byte-identical to every
  round before this for anybody not betting, and narrows the damage if this is
  ever deployed before the paste — to the players who staked rather than the
  whole room.
- **A faked `elapsedMs` is worth more again.** Rank scoring took it from ~5
  points to 100; a wager multiplies it. Bounding `elapsedMs` server-side
  (`ideas-review.md` §5) is the companion change and is still unbuilt. Flagged so
  the decision to ship without it is deliberate rather than overlooked.

## Evidence

- 529 tests, types, lint and build clean. `wager.test.ts` covers the arithmetic,
  the clamp, the gating, and a full reducer round: 1,000 → 3,000 on a won stake,
  900 → 0 on a lost one, and `skip` restoring the board exactly.
- The stake band verified in the design gallery — 2,450 held, 50% reading 1,225,
  `aria-pressed` tracking. **A gallery fixture was added for it**, because a
  control that appears on one question in fifteen would never be reviewed
  otherwise; the last design review found the empty quizmaster's desk only on the
  screens that had a fixture.
- **The room document takes `wagerEnabled` against the *published* ruleset** —
  `check-rules` PASSes `open a room that is played for stakes`. That is the check
  worth having: `wagerEnabled` is a new field on the room document, and the room
  document is what took the game down when squads shipped. It proves the wager
  needs one paste, not two, and cannot stop a round being started.
- `sync-harness 10` after the change: **10/10 joined, 0 dropped**, all ten saw the
  question within 86ms. Run because this touches the answer write.
- `check-rules` **FAILs** on `stake points on your own answer` until the paste,
  which is the point. Its two new deny cases **pass vacuously** in the meantime:
  with `wager` absent from the published `hasOnly`, every stake is refused for
  the wrong reason. They only mean something afterwards.

## Before it deploys

Paste `firestore.rules`, then `check-rules` both directions, then
`sync-harness 10` because this touches the answer write. Then a live round with
**two** answerers on the last question, one staking and one not — which also
clears the rank-bonus gap that has been open since 20 August.
