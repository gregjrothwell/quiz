# Squads during the round

> **Owner: Greg Rothwell. Last updated: 28 August 2026. Budget: 250 lines.**

Split out of [`season.md`](season.md) on 28 August 2026, which reached 282 lines
against a 250 budget when this was added. That file is the season *record* — what
is banked and how. This is the live board shown while the round is still being
played. They meet at exactly one thing, `sideFor`, and that is the point of
keeping it one function.

§2 of [`ideas-review.md`](ideas-review.md), built 28 August 2026.

Squads did nothing until the board *after* the game, which is most of the way to
not having squads at all: the point of a side is watching it win or lose in the
room. `SquadScore` shows it under the standings between questions.

### It ranks on the average, and the first version did not

Built summing each side's points, which **Greg rejected on sight**: *"Bundae get
to play less than Hermes."* Quite right — a raw total means the bigger squad wins
by turning up rather than by answering, and the sides are never even. Bundae
fielding one against Hermes' three would lose every week while playing perfectly
well.

So the board ranks on **points ÷ headcount**, which is the same complaint and the
same answer as the season table ranking on average rather than on points. On the
gallery fixture that turns Hermes 5,550 against Bundae 3,100 into Bundae ahead,
3,100 a player to 2,775 — the smaller side leading because it is playing better.

The screen says **"Average per player"** above the bar. Without it the number
reads as a total, fails to match the standings directly above, and the smaller
squad appearing to lead looks like a bug rather than the point.

Three alternatives were weighed and are worth recording, because the next person
will think of them. **Best N, where N is the smallest squad** — golf's dropped
scores, the direction [`ideas-review.md`](ideas-review.md) §9 wants for the
season — is fair on size but brutal in a live round: with Hermes three and Bundae
one, two of the three Hermes players are told their round does not count.
**Questions won head-to-head** is size-neutral and the most event-like, and is
still on the table as a later change. **Keeping the total** and evening the sides
up on the night was rejected as a seating fix for a maths problem.

**Zero Firebase cost.** The scores are already in the room document and every
client is already holding them; this is arithmetic over what is there. The one
new thing is `squad` on the player entry, which is a rules paste.

Three decisions worth keeping:

- **`sideFor` is one function, shared with `weekSquad`.** The running total shown
  during the round *becomes* the weekly bucket an hour later. Two copies of the
  Lurker rule would not look like a bug when they drifted — they would look like
  the room disagreeing with the record, on a screen showing both. Same reasoning
  that pulled out `liveAnswers`.
- **The squad rides on the player entry, not the season record.** A Lurker's side
  for the night exists nowhere else: it is session storage on the device that
  chose it, so no `seasons` read could find it. It is also the read this avoids —
  one document per player per round, against a room document already re-read on
  every transition.
- **Somebody who has never named a squad is left out entirely**, rather than
  collected into an "unaligned" row. Their points are their own. The bar hides
  itself below two squads, because one side on its own is a bar saying "Hermes:
  all of it".

### One thing that can now disagree with itself

The live board reads the squad off the **room entry**, frozen at join. `recordGame`
banks `rememberedSquad()` read from storage at the **end** of the game. Change
squad mid-round and the two differ — the board shows the side you played as, the
season row records the side you finished as.

Narrow, and each is arguably right for its own purpose, so it is written down
rather than fixed. It could not happen before, because there was no live board.

**The entry is written once, on the seat that creates it** — a rejoin never
restamps it, the same rule `name` and `joinedAt` follow. So somebody who changes
squad mid-round keeps the side they joined under until the next round, which is
the right answer for a running total anyway.

### This one takes the game down if it deploys before the paste
>
> Not "the feature is inert" — **down**. `playerOk` validates the entry with
> `hasOnly`, so a join write carrying `squad` against the old ruleset is refused
> outright and **nobody can join a room at all**. That is a harder failure than
> the vault or the vote, where a refusal cost one feature.
>
> `npm run check-rules` is the gate, and its hint says exactly this. Publish
> `firestore.rules`, watch *write your own entry carrying a squad* turn from FAIL
> to PASS, and only then deploy.

