# The round in review, and the replay

> **Owner: Greg Rothwell. Last updated: 20 August 2026. Budget: 250 lines.**

Moved verbatim out of `docs/HANDOVER.md` on 20 August 2026, when that file reached
2,422 lines. The text is unchanged; only where it lives is.

## The round in review

Two panels under the rosettes, saying what the round did to the room rather than
what the room did to each other: **the one that beat everybody** — a question at
least two people answered and nobody got, shown with the answer they all missed —
and **nobody missed it**, where everyone who answered was right.

**It costs nothing.** `reviewFor` in `src/engine/awards.ts` reads the same
`useGameLog` records the awards already run on, which every device already has
because every device already receives every reveal. No reads, no writes, no rules
change.

Three decisions in it are load-bearing:

- **Two answers minimum.** One person wrong on their own is a guess, not a
  question that beat the room; one person right on their own is already the lone
  wolf's rosette. Both readings need a room to be true of.
- **Candidates are sorted, not taken in log order.** The log's order is a property
  of how *this device* watched the game. Ranking by how many people a question
  happened to, and settling ties on the lowest index, is what stops two screens
  naming different questions — the same failure the awards' sorted joint winners
  avoid.
- **The engine returns an index; the screen holds the prompt.** `Highlight` is a
  question number and a count, and `src/components/Review.tsx` owns every word.
  Same split as the awards and the lobby's level names.

### The log now survives a reload

`useGameLog` mirrors itself into **session** storage, keyed by `gameId`. Session
rather than local because the log describes the game this tab is in the middle of;
local storage would keep a finished game's log on every device forever for
something no later visit can use.

This mattered little while the awards were decoration — the final screen already
withholds them from a partial log, which is better than two screens disagreeing.
It matters a great deal for what comes next, because the same log is what will be
banked against a season, and a reloaded device would otherwise under-report
somebody's honours permanently and silently.

`parseLog` validates on the way **out** of storage as well as in, for the same
reason `cleanName` does: what is in storage is whatever an earlier build wrote
there, or whatever a bored player with the console open put there instead. A
record that will not parse is dropped rather than repaired, which shortens the log
and so withholds the awards — the safe direction.

**Not yet verified in a real room.** The parsing is covered both ways by tests and
the panels were checked on fixtures at 1280, 375 and 320 px, but nobody has
reloaded mid-game against a live room and watched the awards survive.

---

## The replay

The reveal always had a beat between the clock stopping and the verdict landing
— `HUSH_MS`, 700ms of blacked-out lecterns. It is now spent replaying the
question: every player's name lands on the lectern they picked, in the order
they got there, carrying the time they took. The verdict follows the last
arrival.

**It costs nothing.** Every device already holds `room.answers` — who picked
what and how long each took — because that is what the scoring runs on. The
replay reads the same object. No extra reads, no extra writes, no rules change,
nothing new in the room document.

`src/engine/replay.ts` is the whole of the timing, and it is pure and tested.
Two decisions in it are load-bearing:

- **Ties break on uid.** Two answers on the same millisecond would otherwise
  replay in object-key order, which differs between devices — and the room would
  watch two versions of who got there first.
- **The spread is normalised against `fullSpreadFromMs` (2.5s), not against the
  answers alone.** Normalising against the answers would stretch a photo finish
  across the full window: four people within 200ms of each other would arrive
  over more than a second, misrepresenting a scoreline that those 200ms decided.
  Dividing by at least 2.5s compresses a long tail but never exaggerates a short
  one. A tight race stays tight and ends sooner, because there is nothing to
  watch.

**`room.answers` is a new object on every snapshot.** `useRoom` rebuilds it from
scratch each time the subcollection listener fires, so anything memoised on its
identity recomputes whenever anybody's answer changes. The replay learned this
the hard way: memoised that way, a player changing their answer during the
reveal rescheduled every timer from zero, sending each chip back off the screen
to land again and pushing the verdict late. The timeline is now frozen on the
first render that has answers and not recomputed after — deliberately including
the case where a genuinely new answer arrives, because the replay is a retelling
of the question as it closed.

Frozen with a `useState` adjusted during render rather than a ref, which
`react-hooks/refs` rejects, or an effect, which `react-hooks/set-state-in-effect`
rejects. The "no replay" case is a shared constant rather than a fresh `[]`, or
the scheduling effect's dependencies change on every clock tick.

Three things follow from the replay that are easy to undo by accident:

- **The lecterns stay lit while it runs.** The old drum roll blacked out every
  tile but your own pick, which would make three of the four lecterns places
  nobody could be seen landing on. The blackout is still there for a question
  nobody answered, where there is nothing to replay and the beat falls back to
  `HUSH_MS`.
- **`prefers-reduced-motion` is handled in JS, not only in CSS.** The stylesheet
  flattens animations, but the replay is a sequence timed with `setTimeout` —
  motion the stylesheet cannot reach. `useReducedMotion` skips it and goes
  straight to the settled state.

---
