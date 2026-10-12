# Random Round

> **Owner: Greg Rothwell. Last updated: 9 October 2026. Budget: 250 lines.**

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
