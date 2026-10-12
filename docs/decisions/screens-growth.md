# On the box — the fourth harvest

> **Owner: Greg Rothwell. Last updated: 6 October 2026. Budget: 250 lines.**

The first three harvests, the untitled gate and why there is no refusal list are in
[`questions.md`](questions.md) (On the box sections). This file is the fourth batch,
planned in [`pack-growth-plan.md`](pack-growth-plan.md).

## Built — 6 October 2026, `sleeves-batch-7`, local

**296 → 445, so 149 new** (+9 easy / +116 medium / +24 hard; the pack is now
105 / 261 / 79). All first shown in 1990 or later, so the pre-1990 count is still 7
against the cap of 8.

| | n |
|---|---|
| Specs written | 159 |
| Unresolved on the first run, fixed | 3 — *Motherland*, *Cold Feet*, *Lewis*: TMDB dates the series a year after the pilot; year moved, `originCountry: 'GB'` added |
| Unresolved, dropped | 1 — *Who Wants to Be a Millionaire?*: no untitled image at all |
| Wrong show, fixed | 1 — *Big Brother* resolved to the **US** show (Julie Chen by a pool); now `originCountry: 'GB'`, and the still is the eye |
| Refused by eye | **9** |
| Shipped | **149** |

**Refused by eye**, dropped not swapped, as before:

- **Prints its answer:** *QI* (the logo on the screen and the desk card), *Would I Lie
  to You?* (on the card and the backdrop), *Deal or No Deal* (on the screen), *24* (the
  taxi meter reads 24), *Mr Bates vs The Post Office* ("SUPPORT OUR SUB-POSTMASTERS",
  the Aftersun rule: part of the title).
- **The title's own logo letter fills the frame**, judgement calls: *X-Men* (the X),
  *Chicago* (the neon C).
- **Not for an office screen:** *Calendar Girls* (the nude calendar shot), *Ghost*
  (bare-chested clinch), judgement call.

**A bug in the writer, fixed with a test both ways.** The duplicate-title guard compared
TMDB ids across films and TV, but TMDB numbers them separately: movie 95 is
*Armageddon*, tv 95 is *Buffy*. The whole build refused. Keyed by kind now; the new
test in `tmdb.test.ts` fails on the old guard (`same title: 1000, 1001…`) and passes
on the new, and two films on one number are still refused.

## What Greg must look at

`.cache/screens-check-fourth.png`, the 149 new stills, numbered. **The sheet was read by
a model**, as the last two were. Kept, but worth a glance — writing on screen that is not
the answer:

- *Anchorman* (NEWS / CHANNEL 4 on the backdrop), *Wreck-It Ralph* (SUGAR RUSH, FIX-IT
  FELIX, HERO'S DUTY signs), *Brassed Off* (GRIMLEY COLLIERY placard), *Pride* (LESBIANS
  & GAYS SUPPORT THE MINERS), *Loki* (TIME VARIANCE AUTHORITY), *Thelma & Louise* (a
  "filmmodo" watermark), *Have I Got News for You* (newsprint backdrop).
- Office taste: *Saw* (a grimy foot and hand, flecks of blood), *300* (bare-chested
  Spartans), *Benidorm* (swimwear).

A dropped one comes back by restoring its line in `hand-screens-data.ts` and re-running
`npm run write-screens-pack`; the orphaned stills were moved out of `public/`.

## Not done

- **`seed-vault`** — the 149 new answers are in `.cache/hand-vault.json`, not the vault.
  `npm run seed-vault -- --pack screens` before any deploy, never on a Friday.
- The deploy, and `docs/HANDOVER.md` (at its 150-line budget; "On the box 296" there is
  now 445 on this branch).
- Ratings are guesses, 79% medium: the specs came that way.
