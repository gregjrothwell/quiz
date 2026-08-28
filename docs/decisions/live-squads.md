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
room. `SquadScore` shows the running aggregate under the standings between
questions.

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

