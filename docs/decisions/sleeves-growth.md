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

## The story — for Greg to approve

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
