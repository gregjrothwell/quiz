# TV themes — a Name that Tune for the telly

> **Owner: Greg Rothwell. Last updated: 27 November 2026. Budget: 250 lines.**

**Status: built 24 October 2026 on branch `tv-themes`, not live, not seeded.**
*Correction, 27 November:* live since the 25 October release, 65 questions;
batch 2 (below) is built on `PROJ-203-themes`, not live, not seeded.
Approved by Greg the same day with the recommended answers: "originals only,
locked at ten seconds, not in Random Round, call it Theme Tunes". From the 24
October ideas list (`read-games -- --last 40`), where it was idea 4.

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
(`TUNES_MIN_PACK`); 67 is four rounds before a repeat. (65 shipped: the audit
cut two.)

## Decisions for Greg

Decided 24 October 2026, all four as recommended.

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

## What was built, 24 October 2026

- `scripts/hand-themes-data.ts` — 67 specs, slugs `theme-NNN` (the candidate
  row). One correction on the way: rows 77–81 were numbered one off when the
  specs were first typed; a cross-check against `.cache/tv-themes/` caught it,
  one cover-only row came out and the original it had displaced went in.
- `scripts/write-themes-pack.ts` — stricter than Tunes' writer: no artist-only
  fallback, no karaoke or tribute credit. **67 of 67 resolved**, every one a
  track the coverage run had already classed as original. **65 after the
  title audit** (below): 26 easy / 26 medium / 13 hard.
- Pack `themes`: `PACK_META`, `HAND_BUILT_PACK_IDS`, `packNeedsSound`,
  `fixedDurationFor` = 10, show shelf after Name that Tune. Not in
  `RANDOM_SOURCES` — Random Round lists its six packs by name, so nothing was
  needed to keep it out.
- `tune-audit -- --pack themes`: its own cache dirs, and **never prints what
  whisper heard** (`blind: true`).

**Evidence.** `npm test` 1,981/1,981; typecheck and lint clean. Built site
(`vite preview`, 5274), the gallery's every-pack lobby: Theme Tunes is the card
after Name that Tune, "67 questions" (65 after the audit); picking it disables 15 and 20 and says
why, picking Sleeves leaves all three open; `/quiz/packs/themes.json` serves 67,
every preview on Apple's CDN. **AC7, the leak scan**: every programme and track
name grepped over the diff outside the data file and the sealed pack — 0 hits;
a planted name was caught, so the zero means something.

**One instrument lied:** `document.body.innerText` found no pack titles in the
lobby at all, because CSS uppercases them and `innerText` returns the rendered
case. `textContent` is the reading to trust there.

**The title audit**, `tune-audit -- --pack themes`, 15s window, medium.en:
of 67, 62 clean, 3 shifted (005, 017, 044), 1 trimmed (034), 1 unavoidable
(046, cut). The four offsets are in the specs and the rebuilt pack carries all
four. **24 transcribed to no words even with the silence detector off** —
mostly instrumentals, which is what a theme usually is, but the audit's own
warning stands: nothing was looked at in those 24. One of them (085) is a theme
known to shout its title, so it was cut rather than trusted. Nobody has
listened to the other 23, and Greg cannot without spoiling them; the first
office round's hit rate on them is the check (see Risks). The audit re-lists
the four on every run, because it scores the raw transcript, not the offsets.

**Left for the release, in this order:** a What's new line — "A new music
round, Theme Tunes: name the programme from its theme. 65 questions."; `NEW_UNTIL.themes` at go-live + 14 days; `seed-vault --
--pack themes`, then `host-room --pack themes` on the last two ids (anchored
lines only). No e2e spec drives a music pack, so there was no Tunes e2e path
to re-run (AC15 as written); the lobby check above is the browser evidence.

## Batch 2 — 27 November 2026

**PROJ-203, branch `PROJ-203-themes`.** The same pipeline under the same rules:
D1 originals only, numbers only. Scripts and data: `.cache/tv-themes/b2/`.

**Candidates.** 199 rows written by Claude, British first. 96 were not new: 71
are specs already (live or dropped), 2 the same recording as a spec, 1 a batch-1
original the title audit cut, and 22 batch 1 had measured under the same credit
as re-recordings only. **103 new candidates**, `theme-129` to `theme-231`: 93
British, 9 American, 1 Australian.

**Coverage**, with batch 1's client, searches and classification
(`b2/measure2.ts`), and the writer's own pick alongside:

| | Themes |
|---|---|
| **The original recording has a GB preview** | **48** |
| Only a re-recording by someone else | 45 |
| Nothing | 10 |

32 of the 48 match the credit exactly, 16 on a partial credit; the writer picks
all 48. **The instrument was checked first:** a live spec classifies as
*original* from the cache, the first Name that Tune song as *original* on a
fresh search, and an invented programme by an invented artist as *nothing*.

**Vetted before the audit** (`b2/vet.ts`, booleans and numbers only). 4 cut: 133
and 154, whose only GB recording is live (two other searches found nothing
else); 151, a concert version by a symphony orchestra; 222, credited to an
orchestra known for re-recordings. **44 specs**, numbers 134 to 231.

**The title audit**, `tune-audit -- --pack themes`, 15s window, medium.en, over
the 44 new clips: **44 clean, 0 shifted, 0 trimmed, 0 cut.** 39 came back thin
on the first pass (batch 1: 65 of 95) and went through the forced pass. 24 had
words heard, none of them the title. A stricter blind check (`b2/partial.ts`),
any single word of the title of 4+ letters inside 15s, also found none; it does
catch 005's known mention, so the zero means something. **20 transcribed to no
words** even with the silence detector off, so nothing was looked at in them.
Over the whole pack: 108 clean, 1 shifted (005, which already has its offset).

**Wrong options:** where a candidate's options held another theme by the same
composer in the same style, one was swapped (`b2/overrides.json`), as AC4 asks.

**Shipped: 44** — easy 1 / medium 7 / hard 36. The pack goes from 65 to
109 (easy 23 / medium 30 / hard 56). The 65 earlier questions are
byte-identical and in place: the old file is a byte prefix of the new one, and a
rebuild from the cache reproduces the file exactly.

**It leans hard, and the labels say so.** 71 of the candidates were already in
the pack: the famous themes are taken, and what is left is older or less known.
Each label is the hit rate expected of an office (measured live, 25 November:
easy 67%, medium 55%, hard 38%), not a third each; every bucket holds 10+. By kind,
drama dominates (26 of the 44 specs); no quiz or soap theme survived coverage.

**American share:** 4 of the 44; 15 of the 109 that ship. **Before batch 2 the
live pack leaned:** 11 of the 65 that shipped were American, just over one in
six. The test counted every spec, dropped ones included (12 of 93), so it never
saw it. Two tests in `hand-pack-quality.test.ts` now count what ships.

**Wants an ear**, by number:
- Partial credit (composer with an orchestra, or a co-credit), as batch 1's ten
  were: 147, 156, 166, 167, 169, 176, 177, 180, 181, 191, 193, 201, 207, 231.
- Recordings over 4½ minutes, where Apple's 30 seconds may miss the theme: 167,
  209, 228.
- No words heard: 134, 144, 147, 149, 155, 156, 159, 169, 176, 177, 180, 181,
  183, 188, 198, 201, 202, 212, 221, 228. As in batch 1, the first office
  round's hit rate is the check (see Risks).

**Found on the way:** the writer's `NOT_ORIGINAL` does not refuse a live
recording, so 133 and 154 would have shipped live. They were cut by hand and
the writer is unchanged, so no batch-1 pick could move. A guard is worth adding
before batch 3.

**Left for the release:** a What's new line; `seed-vault -- --pack themes`, then
`host-room --pack themes` on the last two ids (anchored lines only).

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
