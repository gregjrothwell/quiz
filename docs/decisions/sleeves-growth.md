# Sleeves — growing the pack again

> **Owner: Greg Rothwell. Last updated: 5 October 2026. Budget: 250 lines.**

The gate, the refusals and why a person has to look are in
[`sleeves-gate.md`](sleeves-gate.md); the song clue is in
[`sleeves-song.md`](sleeves-song.md). This file is the fifth growth batch.

## Why — 5 October 2026

**Greg:** "we need to sort sleeves out with more questions also." The live data
agrees, read the same day:

- **Spent.** `asked-probe`: `season-2/sleeves` holds **105 ids** against **104
  published**. A Sleeves round now is all repeats.
- **Played, and hard.** `read-games`, last ten rounds: Sleeves three times on
  29–30 September (`BRST` 43%, `XDUF` 45%, `8MWE` 31%), nine and seven seats.
  Not since 30 September, which is when it ran out.
- **Yield.** 498 albums have been tried for 104 published, about **21%**. Most
  covers print their own title, and Vision misses a third of the ones that do
  (the gate doc measures this).
- **Songs are standard now**: 102 of the 104 carry a preview from the album.

## The story — approved by Greg, 5 October 2026

> As the quizmaster, I want enough fresh Sleeves for the office to play it
> again without repeats, so the round stays in rotation.

1. **60 more published, 104 → about 164**: four fresh rounds of 15. At the
   measured yield that means **about 280 new candidate albums**.
2. **Candidates weighted towards what survives**: designer-led sleeves,
   portraits where the artist is the image, photographic covers, and the years
   before a title on the front was the default. Albums the office would know,
   leaning British, from the 60s to the 2010s. Never one already tried, so the
   refused stay refused.
3. **Wrong answers as now**: three albums by the same artist, so the cover is
   the only way in.
4. **Same gate.** `sleeve-audit`, `sleeve-refusals.ts` and `sleeve-gate.test.ts`
   are unchanged. **Then Greg looks at the contact sheet** (`sleeve-audit --
   --sheet`, about five minutes) before anything ships. A model's look is not
   enough, and that is measured. The 60 from 26–27 September still waiting on a
   person (Outstanding 1) go on the same sheet.
5. **A song for each**, from the album, run through `tune-audit` so it never
   sings the album title. A song that cannot be cleared means a silent sleeve,
   as the rule already allows.
6. **Ratings are guesses**, as before, until played data replaces them.
7. **Live:** `seed-vault -- --pack sleeves` before any deploy, and not on Friday
   9 October. No rule, client or vault-shape change; `typecheck`, `lint` and
   `test` clean.

**Not in it, but worth Greg's eye:** at 31–45% Sleeves is the hardest round the
office plays (On the box is 85–90%). More of the same keeps it hard. If that
is a problem, the lever is the ratings and the mix, not the gate.

## Built — 5 October 2026, `9095987`, local

**104 → 168, so 64 new.** It took two candidate batches, because the first fell short:

| | Fifth | Sixth |
|---|---|---|
| Candidates | 281 | 169, weighted harder to photographic and art covers, no self-titled albums |
| Pinned by hand (search failed, artist catalogue found them) | 57 | 41 |
| Cleared by the machine | 68 | 42 |
| Refused by eye | **32** | **14** |
| Shipped | 36 | 28 |

- **The look:** Claude marked a contact sheet of each batch, and Greg confirmed both
  ("fine"). The 60 from 26–27 September were on the first sheet too: none refused.
  Reasons for all 46 are in `sleeve-refusals.ts`.
- **About 1 in 7 candidates ships**, not the 1 in 5 assumed. Vision missed nearly half
  of the title-printing covers again, so the person's look is still the gate.
- **Four distractors swapped** where the cover shows the artist and a wrong answer was
  their self-titled album. **Pre-existing and live, reported not fixed:** *Strange
  Days* offers "The Doors" under a cover that says THE DOORS.
- **A wrong release caught:** *Humanz* had resolved to the "Gorillaz 20 Mix"
  single, with the single's artwork. It is now pinned to the album. A scan of all 168
  for singles and EPs finds only the two already known (*Reasonable Doubt*, *Future
  Nostalgia*), which is also how the scan was shown to work.
- **Songs:** 166 of 168. `tune-audit --window 20`: the 64 new are all clean. **The
  script's default window for Sleeves is still 10 s**, stale since the song moved to
  the first frame on 30 September. The audit was run with `--window 20` by hand, as
  it was then. Reported, not changed.
- **Not yet:** `seed-vault` (before the deploy, not Friday), and the deploy itself.
