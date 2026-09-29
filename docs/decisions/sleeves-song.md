# Sleeves, with a song from the album

**Owner: Greg Rothwell. Last updated: 29 September 2026. Budget: 250 lines.**

**Status: approved by Greg on 29 September 2026, with all three decisions as
recommended. Built on `sleeves-song-clue`; not merged, not deployed.** Where
the build differed from the criteria, the change is recorded beside the
criterion.

## Why

Sleeves is tied for the office's most-played pack, and has got harder since the
covers stopped showing their own titles
([`sleeves-gate.md`](sleeves-gate.md)). Read on 29 September 2026 with
`npm run read-games -- --last 40 --pack sleeves` and `--pack tunes`. Hit rates
count a player who did not answer as a miss:

| Round | Date | Seats | Hit | Median |
|---|---|---|---|---|
| `53FN` Sleeves, **before the gate** | 21 Sep | 4 | 85% | 3.0s |
| `RUQC` Sleeves | 22 Sep | 9 | 49% | 4.7s |
| `FR7R` Sleeves | 24 Sep | 7 | 31% | 6.2s |
| `BRST` Sleeves | 29 Sep | 7 | 43% | 4.1s |
| Name that Tune, four rounds | 10–25 Sep | 4–11 | 55–80% | 3.1–4.6s |

**Correction, same day.** The suggestion that led to this story said Sleeves was
"at 31%, near chance". That was one round. Across the three rounds since the
gate it is 31–49%, which is hard but not guessing.

In every sleeve, all four options are albums by the same artist (Beatles, Pink
Floyd, RHCP, Taylor Swift…). So a song from the album tells you the artist,
which the cover mostly does already, but not which album it is. The question
becomes "which album is this song on?". That is real music knowledge, not a
second answer key.

## Story

> As a player in a Sleeves round, I want a song from the album to start partway
> through the question, so that knowing the music can get me the answer when the
> cover alone does not, while whoever knows the cover on sight still gets there
> first and takes the rank bonus.

**Decided by Greg, 29 September 2026:**

- The song is a clue that arrives during the question. It does not only play at
  the reveal, and it does not play from the start.
- No lobby toggle. This is how Sleeves plays.

## Decisions — Greg, 29 September 2026, all three as recommended

1. **When the song starts: half the clock.** That is 5s on a 10s clock and
   7.5s on a 15s one. Tunes players answer 3.1–4.6s after their clip starts
   (median, four rounds), so 5s of a song is enough to help. Sleeves' own median
   is 4.1–6.2s, so roughly half the room will already have answered from the
   cover. That is the design working, not a flaw.
2. **Which song: one picked by hand for each album.** It is recorded in
   `hand-sleeves-data.ts` and resolved from the album's own track list. Apple
   lists tracks in album order and gives nothing about popularity, so "track
   one" is often a deep cut. Picking by hand is 104 lines of content work, and
   Greg reviews the list.
3. **The mute gate applies, as it does for Tunes.** A muted player can still
   play from the cover, but would miss a clue everyone else hears. This means
   adding `'sleeves'` to `packNeedsSound` (`types.ts:61`). The effect, read in
   `Lobby.tsx:261`: every muted player sees "Turn sound on", and Start is
   blocked only while the **quizmaster** is muted. Other players are prompted,
   not forced, exactly as in Tunes today.

## Acceptance criteria

**Pack build** (`write-sleeves-pack.ts`)

1. Each sleeve carries a `previewUrl` for its chosen song. The song comes from
   the album's own track list, fetched with the album's existing
   `collectionId`, from the GB store, and cached like Tunes.
2. **The build refuses a title track.** It refuses any song whose title matches
   the album title (Purple Rain, Back to Black, The Bends, London Calling). Tested
   offline.

   > **Tightened while picking the songs.** "People Are Strange" off *Strange
   > Days* and "Supermassive Black Hole" off *Black Holes and Revelations* both
   > passed a whole-title check, and both are half the answer. One distinctive
   > shared word (four letters or more, not a common one) now refuses too
   > (`songNamesAlbum`, `scripts/sleeve-song.ts`).
3. **The build refuses a clip that sings the album title.** The whisper audit
   runs against the album title as well as the song title. A hit is trimmed with
   `previewSeconds`, or the song is swapped for another. ~~The verdict is checked
   in and enforced offline, as `tune-title-gate` does.~~

   > **Correction, same day, once the code was read.** The Tunes audit does not
   > check in a verdict. It prints numbers, and those are pasted into the spec
   > by hand (`tune-title-audit.ts:8`). This works the same way:
   > `npm run tune-audit -- --pack sleeves`. The audit uses a 10s window,
   > because the song starts at half the clock and the longest clock is 20s. The
   > shortest clip it keeps is 5s. The offline test checks that the pasted cut
   > reached the pack. It cannot re-hear the clip.
4. **A sleeve with no usable song ships without `previewUrl` and plays exactly
   as today.** The build prints the count. The pack floor (`SLEEVES_MIN_PACK`)
   does not count songs.
5. **Question ids do not change.** They are `stableId(spec.slug)`, so the vault
   needs no reseed. Checked by diffing the ids before and after.
6. The seal test still passes. No new key in the pack matches
   `/correct|answer|incorrect|solution/i`.

**Play**

7. The question opens on the cover alone. At half the clock the song starts
   **on every device together**, anchored to the shared clock, not to when each
   screen happened to render, because the rank bonus makes a late clue unfair.
8. It preloads when the question opens. A song that has not loaded by
   half-clock starts when it can, and **never delays the reveal**.
9. The clock bed is muted from the moment the song starts, as it is in Tunes.
   The song stops at the reveal.
10. The volume slider governs it, starting at `DEFAULT_VOLUME`.
11. **Apple's conditions follow the preview, not the pack**
    ([`known-limits.md`](known-limits.md)).
    - A sleeve **with** a song shows "Provided courtesy of iTunes" in both
      phases, and the song's badge and link at the reveal.
    - A sleeve **without** one still claims nothing.

    `QuestionScreen.test.tsx:202` currently asserts that no sleeve shows the
    courtesy line. It splits into those two cases. It is not deleted.

    > **As built:** the badge links to the **album's** store page, labelled
    > "Listen on Apple Music". The song's own `trackId` and link are not stored,
    > so the pack gains no new identifier. The existing test stays unchanged as
    > the no-song case, and the song case is in
    > `QuestionScreen.songClue.test.tsx`.

**Found while building** — not in the original criteria

- **A kept round records a sleeve with a song as `picture`, not `melody`.**
  `kindOf` checked the preview first. That would have moved Sleeves out of its
  own baseline in `read-games` on the round meant to be compared against it.
  The rules do not read `kind` (`grep kind firestore.rules` finds nothing).
  `read-games` and `game-report` are the only readers.
- **The replay button and the `R` key are held until the song is out.**
  Either could otherwise start the clue early for whoever pressed it. The
  button shows "Song from the album at halfway", disabled, so nothing moves
  under the pointer when the song lands.

**Nothing else moves**

12. Scoring is untouched. There are no new room or answer fields and no ruleset
    paste. `check-rules` still passes both ways.
13. `npm run typecheck && npm run lint && npm test` are clean.
14. **Played end to end before it is called done:** a live Sleeves round in a
    browser with `host-room`. The song is heard at half-clock on two devices, and
    a sleeve with no song plays silently.

## Evidence, 29 September 2026

- **Offline.** `npm test`: 1,152 passed, 74 files, before the priming fix,
  and 1,153 after it. `typecheck` and `lint` are clean.
- **The pack.** 102 of 104 sleeves carry a song. The diff against the
  previous `sleeves.json` adds `previewUrl` and nothing else, and all 104 ids
  are identical, so there is no vault reseed.
- **Live, end to end.** `npm run host-room -- 10 --pack sleeves` played two
  real sleeves on a 10s clock. Two browser tabs on separate origins
  (`localhost` and `127.0.0.1`) joined as two anonymous players. An
  instrument in each tab timestamped every `new Audio()` and `play()`, and
  was first checked against a known call.

  | | Tab A | Tab B |
  |---|---|---|
  | Question 1 (*Abbey Road*, with its song) appears | +0 | +40ms |
  | `play()` after the question appeared | **5,002ms** | **5,003ms** |
  | Element played | primed at the open, `readyState` 4 | the same |
  | Question 2 (*Dark Side*, song removed) | no element, no `play()`, no button, no iTunes line | the same |

  The two tabs played 41ms apart, which is inside the clock's 100ms tick.
  Screenshots showed the disabled "Song from the album at halfway" at 1s, and
  "Hear it again" in the same place at 5s left.
- **The first live run failed, and the tests had not caught it.**
  `startClock` stopped every preview, including the primed one. The bed
  starts at 1s on a 10s clock, so the song was fetched cold at half-clock
  anyway (`readyState` 0 at `play()`). The screen test mocked `startClock`,
  so it could not see this. Fixed in `87dfc45`, with a regression test that
  fails without the fix.
- **Not covered.** An iPhone. iOS Safari ignores `preload`, so the reload
  path exists for it. It is reasoned, not run.

## Found while building — pre-existing, not fixed

1. **Two published sleeves show a single's artwork, not the album's.**
   *Reasonable Doubt* resolves to "Reasonable Doubt (Fireworks Supermix) -
   Single", and *Future Nostalgia* to "Future Nostalgia - Single".
   `titleMatches` accepts a prefix, so "future nostalgia single" matches
   "future nostalgia". Both play silent: their chosen songs are not on a
   one-track single. Seen in the track lists this build fetched. The third
   collection flagged, *Music from Big Pink (Deluxe Edition)*, is the real
   album.
2. **A Vite dev server started on 9 September is still holding port 5273**
   (PID 29183, `--host 127.0.0.1`). Its watcher is the kind that has served
   stale code before. This test used a fresh one on 5275.

## How it is measured afterwards

The next Sleeves rounds, compared against 31–49%:

- The hit rate.
- The answered rate.
- The share of answers given after half-clock. That share is the clue doing its
  job, or not.

**If the hit rate is still below 50% over three rounds, the song starts
earlier.** That is a constant, not a rebuild.

## Not in scope

- The song as the only clue, or playing from the start.
- A lobby toggle.
- Hosting any audio. Previews stream from Apple, as Tunes' do.

## Pre-existing, found while writing this — reported, not fixed

**Sleeves and Tunes both publish `trackId` and `storeUrl` in the sealed packs.**
Looking a sleeve's `trackId` up on the public iTunes API returns the album's
name, so anybody who fetches `sleeves.json` can map every question to its
answer. A lookup takes longer than a 10s question for a person, but not for a
script run before the round. This story adds no new identifier: the song's
store link at the reveal carries the same album id. It is not recorded anywhere
in `docs/` (`grep -rn trackId docs` finds one unrelated line). That is Greg's
call, and a separate job.
