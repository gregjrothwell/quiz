# Random Round

> **Owner: Greg Rothwell. Last updated: 20 October 2026. Budget: 250 lines.**

One round that deals questions from different round types — a picture, a tune, a Catchphrase, a price — instead of one pack. Parked 6 October 2026 ([`parked-ideas.md`](parked-ideas.md)); built 9 October on `cursor/random-round`, not played, not deployed.

## What a room still is

A room has one `packId` for the whole round. The quizmaster picks **Random Round** (`random`) like any other pack. That id stays on the room. It is not a published JSON file: `public/packs/` stays at 19 sealed packs, and a re-harvest rebuilds `index.json` from harvested packs plus `HAND_BUILT_PACK_IDS`, which would drop a row that has no file. The lobby row is derived when the index loads (`withRandomPack`), from the six source rows already there. If one of those rows is missing, the button is not offered.

The quizmaster's client, at start, loads the six source packs, samples them, and writes the question list with the same `selectPack` every other round uses. Every other client renders `room.questions`. Nobody samples again. Two devices agree because they read that one write, not because they share a random seed.

## Which packs, and how many

The ones the office plays: **On the box, Sleeves, Name that Tune, Catchphrase, Blankety Blank, The Price Was Right.** Left out: Fine Art, Classical, and Flags (0 rounds in the 14 days before 5 October). There is no Name the artist pack on `8bba4fd`.

Catchphrase is the published pack (90). The client loads `catchphrase.json` the same way it loads any other sealed pack. No answer, phrase, or prompt was read out of the hand-spec file.

The lobby still chooses 10, 15, 20 or 25, and mixed, medium, or The Ladder. The deal splits that length across the six sources as evenly as it can. The remainder goes to the first sources in that fixed order (screens, sleeves, tunes, catchphrase, blanks, prices), so a round of 15 is 3, 3, 3, 2, 2, 2 and a round of 10 is 2, 2, 2, 2, 1, 1 — every source is in it. The written list is then shuffled.

The Ladder does not ramp each source on its own. A ramp of two questions is one easy and one hard, and the types would bunch. It samples mixed, shuffles, then orders the written list gentle to fiendish. Within a difficulty the types stay mixed. That climb is what was written; clients do not sort again.

Each source is chosen with the same `buildQuizQuestions` a single pack uses, including that pack's season history. After the round is under way, the ids are written back onto **each source pack's** `asked` document, not onto a `random` one — otherwise the next On the box round would not know the still had been served. A history that could not be read is not written back, same guard as a single pack. The kept game record says `packId: random` and does not repeat `sourcePack`; the points are already in the deltas. `freshness` therefore counts the round as Random Round, not as six short rounds of the sources.

The lobby's supply number is six times the thinnest source, so a level that source cannot fill reads as thin. On the index at this commit that is Catchphrase's 90 overall, and The Price Was Right's medium bucket.

## How a question behaves

`wellFormed()` bounds `questions.size()` and does not inspect a question object's keys (`firestore.rules`, `function wellFormed`). The same fact [`round-types.md`](round-types.md) used for picture and `expiresAt`. `sourcePack` rides on the question. **No rules paste. Rules were not published.**

`questionPack` reads `sourcePack` when it is set and the room's pack otherwise. An ordinary Catchphrase round writes nothing new and still holds and bonuses as it did.

| Behaviour | Follows |
|---|---|
| Options order | Frozen when the list is written. A Price Was Right question is `ordered`, so its prices stay low to high. Everything else is shuffled once, on the quizmaster's client. |
| Sound | The question's `previewUrl`, as before. A tune plays from the first frame; a sleeve with a song does too (`songClue`, already keyed on a picture plus a song, not on the Sleeves pack). `packNeedsSound('random')` is true, so the lobby will not start the round while muted. |
| Pictures | `image` / `artworkUrl` on the question, unchanged. |
| Catchphrase hold | Half the clock, only when *this* question's source is Catchphrase and it is not a bonus slot. |
| Catchphrase bonus | Still every 5th **position** in the round, and only when the question in that slot came from Catchphrase. A price in that slot is not a bonus. A Catchphrase earlier in the round is not one either. |

## Where the design bent

**One answer window for the round.** Name that Tune's own pack locks the lobby to 10 seconds. A per-question window would disagree with the vault: the gate reads `durationSecs` on the room, and the rules pin that field until a question opens. Random Round keeps the lobby's choice. A tune inside it still stops at its own `previewSeconds`.

**The bonus is the slot, not "every fifth Catchphrase".** A round of 15 holds two or three Catchphrases. The 5th, 10th and 15th questions bonus only if the shuffle put a Catchphrase there.

## What this did not do

No live Firebase: no `seed-vault`, `host-room`, `check-rules`, or `sync-harness`. The vault already holds these question ids (unique across the six packs; checked 9 October, 1,414 ids, no collision). No rules paste, no change to derived quizmaster, no write of the whole `players` map. No Name the artist. No Catchphrase answer in this file or the commit. The Mac Mini drawing pipeline was not touched. The game record does not store `sourcePack`.

## 20 October 2026 — the last question is never a sleeve or a price

**Greg:** the last question is always a music album, the hardest kind, "so it's almost like the last question is a random answer". The last question carries the wager and Share or Shaft, so that matters more than one question's worth.

**Measured** (`read-games --pack random`, each question id mapped back to its pack): nine Random Rounds, 12–19 October, **all on The Ladder** (the lobby's default), so the last question is always one labelled `hard`. A sleeve was last in **7 of 9**, and 18% of the room got those right. Hard questions by source across the nine: Sleeves 31% (21 asked), The Price Was Right **6%** (9), Blankety Blank 38% (4), Catchphrase 77% (18), On the box 88% (2). A fair shuffle would have put a sleeve last about 3.8 times in 9, so 7 is above chance as well as structural: Sleeves is 58% `hard`, against 18% for On the box and 12% for Tunes.

**Decided, Greg, 20 October:** the last question is never an album or a price. They still appear earlier in the round.

**Built** (`randomRound.ts`): `FINALE_SOURCES` is On the box, Tunes, Catchphrase and Blankety Blank. One of them, at random, deals the last question, and it counts against that source's share, so `quotasFor` still holds. On The Ladder it is that source's hardest fresh question, and a source whose hard questions have all been served is passed over, so the climb still ends on `hard`. Every other level deals it the way it deals the rest.

| Check | Result |
|---|---|
| Two new rules (never a sleeve or price last; a fair source with no fresh hard is passed over) | fail on `master`'s deal, pass on this one |
| Allow direction: sleeves and prices still dealt; every share still `quotasFor` | pass on both |
| 2,000 Ladder deals each at 10, 15 and 20, real packs | last question ~25% each across the four; 100% `hard` |

**Not covered.** Whether a hard Blankety Blank or Tunes question is fair as a finale: four hard blanks and no hard tunes were played in the nine rounds. The next office rounds are the check (`read-games --pack random`). The deal is client-only: no rules change, nothing seeded.
