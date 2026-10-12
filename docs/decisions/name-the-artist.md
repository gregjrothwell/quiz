# Name the Artist

> **Owner: Greg Rothwell. Last updated: 9 October 2026. Budget: 250 lines.**

Parked 9 October 2026. A clip plays and the question is who is playing, not the
song. It is meant to be easier than Name that Tune. Built as its own pack so a
mixed round can deal it later. That other branch is not a dependency of this
one.

## What it is

Pack id `artists`, lobby title **Name the Artist**. Prompt: "Name the artist."

The clip, the store link and the `trackId` are copied off the published Name
that Tune question (`public/packs/tunes.json`). No new audio, no iTunes lookup,
no Firebase. The Apple badge still appears only at the reveal, same as Name
that Tune.

A sung title is not the answer, so the title-gate does not apply.
`previewStart` and `previewSeconds` are not copied, and `fixedDurationFor`
stays null: the lobby's window stands. Name that Tune stays locked at ten
seconds. `packNeedsSound` is true, same mute gate as the other clip packs.

Question ids are `stableId('artist-' + song slug)`, so seeding this pack cannot
overwrite a Name that Tune answer. The vault is one id space
([`hand-pack-quality.test.ts`](../../scripts/hand-pack-quality.test.ts)).

## How big

One question per distinct `artist` string in the tunes catalogue, and only
where that artist already has a published clip. The cap is one, so the same
artist is the answer once and cannot be the answer on most of the pack.

Which clip: the easiest song that artist already has, then the one earlier in
the catalogue. The question's difficulty is that song's. No artist was added
who is not already in the catalogue.

| | |
|---|---|
| Tunes in the catalogue | 424, all with a published clip |
| Questions | **259** |
| Easy / medium / hard | **131 / 98 / 30** |

Hard fills one 25-question round, or two of 15. A third fiendish round repeats,
and the ladder already substitutes medium when a bucket is spent.

## Wrong options

Three other artists from this pack.

Where the data supports it, they are artists the catalogue already treats as
nearby: one spec's wrong song title is another artist's song, and that title
belongs to exactly one artist. The link counts both ways. More of those titles
ranks higher. A title shared by two artists is not a link.

| Neighbours among the three wrong options | Questions |
|---|---|
| 3 | 27 |
| 2 | 33 |
| 1 | 42 |
| 0 | **157** |

The 157 have nothing in the wrong-song lists to go on. Their other options are
still catalogue artists, rotated from a stable hash of the answer so the same
three names are not the fill on every sparse question. The most common wrong
option appears 11 times.

**Judgement: this will often be easy, and it ships anyway.** A voice against
three other names, even nearby ones, is easier than naming the song, which is
the point. Where there is no neighbour the gap is wider. The office vote is
the backstop.

The answer is the catalogue's `artist` string. A featured vocal keeps the
billed credit. The catalogue does not store a second name, and inventing one
would be a different pack.

## Not seeded

`npm run write-artists-pack` writes the sealed pack and merges answers into
`.cache/hand-vault.json` only. That cache is gitignored.

**The pack is unseeded. It will break at the reveal until:**

```bash
npm run seed-vault -- --pack artists
```

That command was not run. Nothing was pushed, merged, or deployed. The handover
state section still describes what is live, including its hash and "19 packs".

## What this does not change

Derived quizmaster. A phase transition still does not write the `players` map.
No rules paste: the rulesets do not name pack ids. No tune-audit, and the
audit's cuts stay on Name that Tune only.

## Risks

- **Too easy.** Recorded above. 157 questions have no same-era signal in the
  data. Ship, and let the vote retire the ones that are obvious.
- **Intros.** Some previews open before the vocal. The audit's start offset
  exists to dodge a sung title, so this pack does not use it. A clip that is
  only an intro for the first ten seconds wants an ear later, not a cut copied
  across.
- **Unseeded.** Reveal throws until the command above.
- **About a third of the 259 are American acts**, counted by where the act was
  formed, which the catalogue does not store. They are the household names
  already on Name that Tune, not a list that needs American knowledge. The pack
  does not lean American overall. Collapsing several songs by one British act
  into a single question does shift the mix toward the long tail, American
  included.
