# TV themes — a Name that Tune for the telly

> **Owner: Greg Rothwell. Last updated: 24 October 2026. Budget: 250 lines.**

**Status: story for approval, 24 October 2026, branch `tv-themes`. Nothing
built.** From the 24 October ideas list (`read-games -- --last 40`), where it
was idea 4.

**Blind.** Greg plays this pack blind, said 24 October before any theme was
named. This file, commits, PRs, test names and build logs refer to a theme by
its number only — never a programme, a composer, a track or a lyric. Candidates
live in `.cache/tv-themes/` (ignored) and are never printed into a transcript.

## Why

Name that Tune is one of the most played rounds (8 of the last 60 kept rounds,
20 October, [`lobby-shelves.md`](lobby-shelves.md)) and scored 65% on its first
real outing ([`tunes-round.md`](tunes-round.md)). On the box is the other one
the office reaches for. A theme tune round is the two put together, on a
pipeline that already works: Apple's 30s GB preview, streamed, never stored.

## The story

> **As** the office,
> **I want** a round where a TV theme plays and we name the programme,
> **so that** the telly we grew up with gets its own music round.

## Coverage, measured 24 October 2026

100 candidates written by Claude, British first (87 British, 12 American that
any British office knows, 1 Australian). Each was searched on the GB store with
the same rate-limited, cached client the Tunes pack uses (`scripts/itunes.ts`).
Script and results: `.cache/tv-themes/measure.ts`, `coverage.json`.

| | Themes |
|---|---|
| **The original recording has a GB preview** (credited artist matches, title matches) | **67** |
| Only a flagged recording found (karaoke, tribute, "made famous by") | 2 |
| **Only a re-recording by someone else** | **30** |
| Nothing | 1 |

Of the 67: 56 British, 10 American, 1 Australian. 57 match the credited artist
exactly; 10 match on a partial credit (a composer with an orchestra, say) and
want an ear before they ship.

**The instrument was checked first** (EVIDENCE.md): two known Name that Tune
songs classify as *original*, and an invented programme by an invented artist
as *nothing*. A clip being the original recording is a claim about the artist
credit, not the audio — the title audit and a listen are what prove a clip.

**67 is enough.** A Tunes round is 15 and the pack floor is 45
(`TUNES_MIN_PACK`); 67 is four rounds before a repeat.

## Decisions for Greg

- **D1. Originals only, or re-recordings too?** Recommended: **originals only**
  for version one (67). The 30 re-recordings are mostly library orchestras
  copying the theme; some are faithful, some are not, and a wrong-sounding
  theme is the "clip that is the wrong song" failure Tunes already had once.
  They are the growth batch, each one listened to.
- **D2. The clock.** Recommended: **locked at ten seconds**, like Name that
  Tune. Several themes are sung, and a sung theme often sings the title.
  `tune-audit` trims what it hears; ten seconds is the cheap second guard.
- **D3. Random Round.** Recommended: **not until it has been played**, the same
  call as The Price is Right.
- **D4. The name.** Recommended: **Theme Tunes**, lobby blurb "Name the
  programme from its theme." Alternative: *TV Themes*.

## Acceptance criteria

1. **A new pack, `themes`**, on the lobby's show shelf straight after Name that
   Tune; hand-built (`HAND_BUILT_PACK_IDS`), sound required (`packNeedsSound`),
   and named as D4 decides.
2. **Every question plays an Apple GB preview of the original recording** —
   artist credit matches the spec, URL on `audio-ssl.itunes.apple.com` — and
   the store badge appears only at the reveal, as on Name that Tune.
3. **The pack builds only if at least 45 resolve**, and the writer says out
   loud, by number, any theme that skipped or whose Apple title did not match.
4. **Prompt and options:** "Which programme is this the theme to?", four
   programme titles. Distractors are programmes from the same era and kind
   (sitcom with sitcom, sport with sport), never one whose theme sounds alike
   enough to be fair to confuse.
5. **British office rule:** no option needs American knowledge; American
   themes are world-famous ones only, and the pack does not lean American
   (at most one in six).
6. **Sealed:** no file in `public/packs/` holds an answer; `seal.test.ts`
   covers the new file both ways.
7. **Blind-safe build:** slugs are `theme-NNN`; `write-themes-pack` prints
   numbers, never a title; any e2e spec uses synthetic prompts. A `grep` of the
   diff for each programme title in the pack returns nothing outside
   `scripts/hand-themes-data.ts`.
8. **Title gate:** `tune-audit` runs over every clip; one that sings or says
   the programme's name inside the window is trimmed (`previewStart`,
   `previewSeconds`) or cut. Counts reported, not titles.
9. **Clock as D2 decides**, and the lobby says why if it is locked.
10. **Difficulty spread:** every bucket (easy, medium, hard) holds at least 10,
    so the Ladder can climb one round without substituting.
11. **Ids cannot collide** with any other pack's in the vault
    (`stableId('theme-NNN')`; `hand-pack-quality.test.ts`).
12. **Seeded before it ships**; `host-room --pack themes` on the **last two**
    ids reveals from the vault (anchored log lines only).
13. **Random Round as D3 decides.**
14. **A What's new line.**
15. **Green:** typecheck, lint, `npm test`, and the Tunes e2e path on the new
    pack.

## Not in version one

- The 30 re-recordings (a later batch, each listened to).
- An "On the box" still at the reveal. Nice, but it is a second pipeline.

## Risks

- **The first office round is the live check** — `read-games --pack themes`.
  A hit rate near 100% on `hard` means a clip is reading the answer out, as it
  did on Name that Tune.
- **A preview can be the wrong 30 seconds** — a long theme's preview may be a
  bridge nobody knows. `previewStart` fixes that, but only somebody listening
  finds it; Claude listens via the audit transcript, not by ear.
