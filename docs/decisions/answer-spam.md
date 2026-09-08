# Spamming the answer keys

> **Owner: Greg Rothwell. Last updated: 8 September 2026. Budget: 250 lines.**

**Status: proposal. Nothing is built.** Greg reported it on 8 September and
asked for the best shape before any code.

## What happened

> "A player was spamming the keyboard shortcut upon question start — then
> keeping that as his answer if it happened to be right, or changing it. This
> meant he was first answering many times due to chance." — Greg, 8 September

He is right that it is cheating, and right that it works. It is worth being
precise about *why* it works, because that rules out most of the obvious fixes.

## The exploit is a free option, not fast fingers

Three existing behaviours combine, each correct on its own:

1. **A pick can be changed until the clock runs out**, and the change restamps
   `elapsedMs` to the moment of the change
   ([`reducer.ts:216`](../../src/engine/reducer.ts#L216),
   [`useRoom.ts:837`](../../src/lib/useRoom.ts#L837)). Deliberate, and the
   comment says why: keeping the first stamp would let you bank a fast guess
   and revise at leisure.
2. **`elapsedMs` decides the rank bonus** — 500 for first down to 100 for fifth
   ([`scoring.md`](scoring.md)) — and the first correct answer also takes 5% off
   the leader when the room is playing steals
   ([`round-types.md`](round-types.md#steal-points--built-4-september-2026)).
3. **The keyboard handler is gated on the clock, not on having answered**
   ([`QuestionScreen.tsx:284`](../../src/screens/QuestionScreen.tsx#L284)), and
   it does not check `event.repeat`.

So: press A–D at 50ms. The last press stands, at a stamp nothing honest can
beat. **A quarter of the time it is right and wins the question outright. The
other three quarters he reads the question and revises at his normal speed, at
no cost whatsoever.** He is not playing faster. He is buying a free lottery
ticket every question, and the ticket has no losing side.

### What it is worth, in this room's own numbers

`3QDV` (Science, 8 September, 8 players, 15 questions) scored 45,500 points
across 120 answer opportunities: **379 points per chance.** The fastest honest
answer anywhere in a 38-answer sample from five rooms was **1.54s**, so a 50ms
stamp is first, always.

| | points per question |
|---|---|
| Playing honestly | **379** (measured) |
| Spamming, today | 0.25 × 1,000 + 0.75 × 379 = **534** |
| Spamming, if the pick were final | 0.25 × 1,000 + 0.75 × 0 = **250** |

**+41% today. −34% if a pick cannot be taken back.** That gap is the whole
problem and the whole fix.

## Why the obvious fixes leak

Each of these was worked through and each fails, for the same reason: *they do
not charge for the early press.*

- **Rate-limit the keystrokes** — what the report asked for. Four tiles are
  also four mouse taps, so it moves the cheat to the pointer and stops nobody.
- **A floor on `elapsedMs`** ("nothing counts before 1s"). The cheat presses at
  1.05s instead. Placing the floor where it would actually bite means placing
  it at honest players' reading speed, which punishes the people it is meant to
  protect.
- **A cooldown after each pick.** A lockout only costs you if it runs past the
  time you were going to answer anyway. For somebody guessing at 50ms it never
  does. Structurally incapable of pricing an early guess.
- **Cap the picks per question** (say two). He presses *once* at 50ms and keeps
  his change in hand. The ticket is still free.
- **A changed answer forfeits the rank bonus but keeps the 500.** Closest of
  the near-misses, and still profitable: 0.25 × 1,000 + 0.75 × ~250 = **437**,
  against 379 for playing properly.

### Rate-limiting the keys is the one that looks right and does nothing

Raised by Greg on 8 September: limit the shortcut to one press a second.

**Four presses and one press are the same bet.** He gets no feedback on whether
a pick was correct, so he cannot choose between his own presses — he only ever
keeps the last one, and any single blind pick is 25%. Spamming A–D at 50ms and
pressing A once at 50ms have identical value. A one-a-second limit leaves him
pressing once at 50ms, reading, and pressing again at 4s: **EV unchanged at
534.**

The spamming is the *tell*, not the mechanism. This matters beyond this one
idea, because it is why every "slow him down" shape fails — the exploit needs
one press, and no rate limit can stop one press.

### The part that cannot be fixed, and what it forces

**A lucky unchanged guess is indistinguishable from instant knowledge.** Both
are one pick, at one time, never revised. No rule can tell them apart, because
there is nothing to tell apart — the data is identical.

So the lucky quarter is not addressable at all, and the only lever left is the
unlucky three quarters: **make the early press binding.** Everything that does
not bind it leaks, and everything that binds it works. That is the whole
solution space.

It also disposes of the commit window — "your pick is final until T seconds,
free after that" — which looks like the subtle answer and is not. At T = 3s he
waits three seconds and presses blind at 3.05s, which still beat the rank-1
answer in four of the five rooms sampled: **back to 534.** Pushing T out to 6s
does close it, but 6s binds five of the eight players in `DTK8` anyway, so it
is finality wearing a constant.

## Recommendation — the first lectern you touch is your answer

**One pick per question. No changes.**

It is the only shape that closes it, because it is the only one that makes the
early press cost something. Everything else leaves him doing both — taking the
lucky wins and revising away the losses — and it is *having both* that is the
cheat, not the speed.

What recommends it beyond that it works:

- **It is one rule, with no constant to tune** and no residual to re-visit when
  somebody adapts. Every other option above ships a number that has to be
  guessed and then defended.
- **It is a smaller change than the alternatives**, and it *removes* a write
  path rather than adding one. A change is a second write fanned out to every
  client in the room, and the round already grows with the square of the
  headcount ([`cost.md`](cost.md)).
- **The room already plays this way.** 37 of the 38 sampled answers landed
  after 3 seconds; people are deliberating before they press, not fencing with
  the change feature.
- **It says out loud what the rank bonus already claims** — the order in which
  people committed.
- **The first press wins, not the last**, which is the natural reading of "your
  answer is your answer" and is strictly worse for a scattergun: he gets
  whichever key his hand hit first.

### What it costs, plainly

**A mis-tap is unrecoverable** — meaning to press B and hitting C loses the
question. That is the real price and it is worth Greg's explicit yes rather
than being buried here. On a phone it is a fat-finger; on a keyboard it is
rarer.

### Better: pick freely, then lock — "is that your final answer?"

Raised because plain finality is blunt and the mis-tap is the only real
objection to it. **Move your pick as much as you like; a second, deliberate
action locks it in, and the lock time is your stamp.**

It gives exactly the same protection. A spammer who hammers A–D locks nothing;
to score at 50ms he has to deliberately lock a blind guess, which is binding,
which is 250 against 379. Identical arithmetic to finality, arrived at by his
own explicit choice rather than by a rule catching him out.

What it buys over plain finality:

- **The mis-tap goes away.** Meaning B and hitting C is recoverable, because
  nothing is committed until you say so.
- **It is the mechanic the room already understands.** Every quiz show on
  television asks the question, and the commitment is the drama rather than a
  penalty.
- **It writes less, not more.** Today every change of pick is a write fanned
  out to every client in the room, and the round already grows with the square
  of the headcount ([`cost.md`](cost.md)). Locking writes **once per question,
  ever** — no intermediate picks reach Firestore at all. No new field on the
  answer document, so **no ruleset paste**.

What it costs: **a second action on every question**, for everyone, all night.
Eight players over fifteen questions is 120 extra presses to stop one person
cheating, and it slows the beat of a round that is deliberately fast. That is
the trade, and it is the only one worth arguing about — the arithmetic is
settled either way.

Ranks are unaffected: everyone's stamp moves later by the same lock action, so
the order is the order.

## What it touches

Not costed against Firebase because it adds nothing; it takes one away.

| Where | Change |
|---|---|
| [`reducer.ts`](../../src/engine/reducer.ts) `answer()` | Refuse when `state.answers[uid]` already exists. The engine is where this wants pinning, so the tests read as rules |
| [`useRoom.ts`](../../src/lib/useRoom.ts) `submitAnswer` | Same guard, replacing the "identical pick and stake" check that is there now |
| [`QuestionScreen.tsx`](../../src/screens/QuestionScreen.tsx) | Tiles `disabled` once answered; keyboard returns early; **`if (event.repeat) return;`** so a held key is one press. Worth doing whatever else is decided |
| The screen, visibly | It must *say* the answer is locked. A press that silently does nothing is the exact failure this codebase keeps writing up |
| `firestore.rules` | **Optional, and second.** `answers/{uid}` grants `create, update` with no immutability check ([`useRoom.ts:793`](../../src/lib/useRoom.ts#L793)); denying `update` would enforce it against a crafted client too. Different threat from a colleague at a keyboard, and the rules are pasted by hand — [`security.md`](security.md) |

### One knock-on, on the wager question

The stake rides on the answer document, and today it can be moved after
answering by rewriting the answer
([`QuestionScreen.tsx:477`](../../src/screens/QuestionScreen.tsx#L477)). A
final answer makes the stake final with it, so the stake has to be chosen
*before* the pick. That is already the natural flow — the stake is held in
local state until you answer rather than written on selection
([`QuestionScreen.tsx:105`](../../src/screens/QuestionScreen.tsx#L105)) — but
it is a real change to the wager round and should not be discovered during a
game. [`wager.md`](wager.md).

## Evidence behind the numbers

Read off the live project on 8 September, not reasoned from the docs.

- 38 answers from the last question of `3QDV`, `DTK8`, `4WR4`, `XS4A` and
  `FWAP`, all on 15-second windows. Sorted, the fastest six are 1.54, 3.44,
  3.75, 4.04, 4.07, 4.16 seconds. **One is under three seconds; two are under
  four.** The answer that took rank 1 in each room: 1.54, 3.75, 4.41, 4.16,
  7.93.
- `3QDV` scores: 7,999 · 7,805 · 6,499 · 6,464 · 6,400 · 4,000 · 3,933 · 2,400
  = 45,500 over 15 questions and 8 players.
- Only the current question's answers survive in `rooms/{code}/answers`, so
  this is one question per room rather than a full distribution. Reading every
  answer costs ~13,700 reads against a 50,000/day tier and has taken the game
  down before ([`cost.md`](cost.md)) — so it was not done, and the sample is
  small on purpose.
