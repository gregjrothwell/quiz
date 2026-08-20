# The buzzer-beater

> **Owner: Greg Rothwell. Last updated: 20 August 2026. Budget: 250 lines.**

Moved verbatim out of `docs/HANDOVER.md` on 20 August 2026, when that file reached
2,422 lines. The text is unchanged; only where it lives is.

## The buzzer-beater the reveal used to throw away

A real bug, found while looking for a different one. **It is not what was
reported on 17 August** — see the correction at the end of this section — but it
stands on its own, and it is worth reading before touching `dispatch` or
`handleReveal`.

`handleReveal` asks the vault and then dispatches:

```js
const correctIndex = await openTheVault(room.code, question);
await dispatch({ type: 'reveal', correctIndex, questionId: question.id });
```

`openTheVault` is not cheap. It fires **four concurrent `setDoc` writes** — one
per lectern, three of which the rules refuse — and waits for all four. That is a
full network round trip, and on a phone it is the slowest of four.

`dispatch` used to fold the reveal over the `room` its own closure was created
with, which is the room as it stood *before* that round trip. Every answer that
landed during it was in a newer room object that closure could never see. The
player answered inside the window, watched their lectern light, and scored
nothing. Next question they were fine — so it reads as falling a question behind
and then catching up, which is exactly how it was reported.

Two things make the window wider than the round trip alone:

- **The quizmaster's clock is the earliest in the room.** They wrote the update
  that opened the question, so their local echo is instant while everyone else
  waits on the fan-out. They call time while other screens still show a fraction
  of a second left.
- **Nobody is told.** There is no "your answer didn't count". The lectern lights
  up locally the moment it is tapped.

It costs whoever answers latest, on whichever question they cut it finest.

Fixed by folding over `roomRef.current` — the newest room this client has seen —
rather than the closure's copy. That also turns the round trip into grace time
rather than a blind spot, which roughly cancels the quizmaster's head start.

**The `questionId` on the reveal action exists because of that fix, not
independently of it.** Folding over the current room means the room could in
principle have moved on during the round trip, and applying one question's answer
to the next would mark the entire room wrong on a question nobody got a chance to
answer. The reducer now refuses a reveal whose `questionId` is not the question in
play. Keep them together: removing the guard makes the fold unsafe.

### The diagnosis this was attached to, and why it was wrong

It was pinned on the 17 August report — a player falling a question behind and
then catching up — on the strength of one number: he answered the last question
at 12.2s of 15s, where the rest of the room came in between 3.7s and 6.8s. The
slowest answerer is the one this bug costs, so it fit.

It made a falsifiable prediction, which is the only reason the mistake was cheap:
`verdictFor` shows a lost answer as `Correct · +0`, so the player would have seen
that on screen. **He was asked, and he had not.** What he actually described was
his timer sitting at zero after the question was over, and, separately, a face
reading five seconds that snapped to zero with the lecterns going dead. Neither
is this bug — he never got an answer in at all. See [the clock, and what it
actually costs](clock.md#the-clock-and-what-it-actually-costs).

Two things worth keeping from that:

- **A plausible mechanism plus a matching number is not a diagnosis.** Every
  piece of evidence here was consistent with the theory and none of it was
  evidence *for* it, because nothing had been checked that could have come back
  no. The reveal-gap bug is real; the attribution was invented.
- **Ask the person first.** One question to the player settled in a sentence what
  a day of reading Firestore could not, and it settled it against the theory.
  Same lesson as the console tab in the 15 August session, one section down.

### Reproducing it

Not observable in one browser, and not observable on localhost with a fast
connection, because the window is the length of a round trip. What it needs is a
real device on real wifi answering on the buzzer:

1. Two devices, one phone among them. Host a round with a **10-second** window —
   the shorter the window the larger the round trip is as a fraction of it.
2. On the phone, tap an answer as late as you dare, inside the last half second.
3. Watch the standings. Before the fix, that answer scores nothing perhaps one
   time in three, and nothing on any screen says why.

`scripts/host-room.ts` is not the tool for this: it runs the reveal from Node, so
it does not exercise the App's closure at all.

### Telling the player, which is the part that matters

The bug above cost one question. What cost a week was that **nothing said it had
happened**. The screen read `Correct · +0` — the game contradicting itself — and
the only way to find out why was to pull the room out of Firestore days later.

`verdictFor` in `engine/scoring.ts` now names four outcomes rather than three,
and the fourth is `lost`. The test for it is exact rather than a heuristic:
`tallyQuestion` emits an entry for **everyone** whose answer was scored,
including a zero for everyone who got it wrong. So a player holding an answer
with no entry at all was not in the tally, and there is no other way that
happens.

It shows in amber, not the verdict red, on the same principle as `.nudge`: this
is not the player getting it wrong, it is the game failing to count them, and red
would tell somebody who answered correctly that they were wrong.

**It generalises across every way an answer can go missing** — it does not know
or care *why*, only that the room scored the question without it — but note the
limit, because it was overstated when this was written: **it only fires for a
player who got an answer in.** It says nothing to somebody who could not answer
at all, which is the 17 August report. Different failure, different indicator.

There is a fixture for it in the preview gallery — *Reveal · answer didn't
land*. Note that adding it exposed a stale one: *Reveal · wrong answer* named
only the scorer in `lastDeltas`, which no real tally ever does, and it started
showing the other three a fault that had not happened. Any new reveal fixture
must list every answerer.

---
