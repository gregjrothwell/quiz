# The Price Was Right — then and now

> **Owner: Greg Rothwell. Last updated: 17 October 2026. Budget: 250 lines.**

Parked idea #2 ([`parked-ideas.md`](parked-ideas.md)), picked by Greg 6 October 2026 over ghost
racing and Blankety Blank's match-the-room, to build **before the next go-live**.

**Greg plays it blind** (6 October): no item's old price appears in this file, in chat or in a
commit message. Slugs are numbers. **Four items were spoiled** in the first draft of this file
and in a question to Greg — a man's haircut, a pub pint of draught lager, a takeaway fish and
chips, a double duvet — and are **left out of the pack**.

## Greg's changes to the first draft — 6 October 2026

1. **Today's price given, the old one guessed.**
2. **Mixed gaps: 5, 10, 20 and 30 years.** Otherwise one rate of increase answers everything.
3. **A variety of categories**, for the same reason: items that rose a lot, a little, and not
   at all, side by side.

## Sources — checked 6 October 2026

Every price is the ONS's own. Each question names **both dates**, because the two sources
end at different months.

| Gap | Then → now | Source | Items with both |
|---|---|---|---|
| 5 years | Aug 2021 → Aug 2026 | Shop price quotes | **332** |
| 10 years | Aug 2016 → Aug 2026 | Shop price quotes | **280** |
| 20 years | Jan 2005 → Jan 2025 | RPI average prices | **43** |
| 30 years | Jan 1995 → Jan 2025 | RPI average prices | **39** |

**Shop price quotes**
([dataset](https://www.ons.gov.uk/economy/inflationandpriceindices/datasets/consumerpriceindicescpiandretailpricesindexrpiitemindicesandpricequotes)):
the raw prices collectors record in shops each month. Latest August 2026; next release
21 October. The price is **the median of that month's valid quotes**, at least 30 shops,
usually 100–440. Valid: `validity` 3 or 4 before 2025 (old glossary: "only codes 3 and 4
used"), `VALIDITY` True after. Matched on item code **and** description. Pub, takeaway,
clothes, household, services, leisure. **No groceries**: the 2026 glossary says the quotes now
exclude "grocery categories (COICOP Divisions 1 and 2)".

**RPI average prices** (series in the
[MM23 dataset](https://www.ons.gov.uk/economy/inflationandpriceindices/datasets/consumerpriceindices)):
65 series, monthly from 1971; 49 of them end at **January 2025**. Groceries, petrol, diesel,
cigarettes, pub pints. Pence. They fill the gaps the quotes cannot: the quotes have nothing
between January 1996 and 2010, and 1996's item codes share nothing with 2026's (0 of 502), so
a 30-year pairing would be by hand.

**British by construction** — ONS, UK shops — the [`AGENTS.md`](../../AGENTS.md) principle.

## Story — revised, for Greg

**As** an office player, **I want** to be told what an everyday thing costs now and guess what
it cost 5, 10, 20 or 30 years earlier, **so that** there is a round anyone can play from their
own memory of prices, which no single rule of thumb answers.

### Acceptance criteria

1. **A pack in the lobby**, at least 60 questions and at least 15 at each level.
2. **Each question names the item in plain English, the later price and both dates**, and
   asks for the earlier price. Four price options, sorted low to high.
3. **Mixed gaps and categories.** At least 15 questions at each of 5, 10, 20 and 30 years.
   No category is more than a quarter of the pack. Each item appears once.
4. **Every price is computed from the ONS files** by a script that downloads them, so it can
   be re-run and checked. No price is typed by hand. A series whose unit changed inside its
   gap is left out.
5. **No option gives itself away.** All four rounded the same way, answer included; at least
   12% apart; the true one equally likely in each position; where the price fell, at least
   one option above the later price.
6. **Difficulty is the spacing** — wider is easier — recorded per question.
7. **Item names are hand-written**; obscure items are left out, and so are the four spoiled.
8. **Sealed and seeded** like every pack: no answer in `public/packs/`, the vault seeded and
   read back before deploy, one `host-room` reveal end to end. **No engine change, no rules
   paste.**
9. **Blind**: reports, tests and commits name slugs and counts, never an item's old price.

**Approved by Greg, 6 October 2026.**

## Built — 6 October 2026, branch `office-feedback-6-oct`, local

| | |
|---|---|
| Fetch | `npm run prices-fetch`: downloads the three quote files and MM23 into `.cache/prices/raw/`, writes `.cache/prices/observed.json`. **95/95 specs have both prices** |
| Cross-check | The script's medians against an independent Python reading of the same files: **190 of 190 price pairs agree** |
| Pack | `npm run write-prices-pack`: **95** — 30 at 10 years, 25 at 5, 20 each at 20 and 30; levels **33/32/30** |
| Variety | 6 items got cheaper and 2 stayed within 5%; one more than quadrupled (a series where duty explains it), kept as the ONS records it |
| Seal | `prices.json` holds `id/question/options/category/difficulty/ordered`; no answer-like key |
| Tests | `prices-core.test.ts` (20) and `write-prices-pack.test.ts` (15), on **invented** prices; 1,358/1,358 overall |
| Screen | Gallery fixture *Question · The Price Was Right* (an invented item): options low to high, chip "10 years ago", no overflow, no console errors |

**One acceptance criterion did not hold as written: AC 8, "no engine change".** The client
shuffles every question's options (`buildQuizQuestions`), which defeats AC 2's low-to-high
order. Fixed with the smallest change that does it: `ordered: true` on a sealed question
deals its options as the pack gives them (`1de868b`). Client-only, no rules paste. The answer's
place is spread evenly by `balancedPositions`, so the order gives nothing away.

**Not done, and needed before it ships:** `npm run seed-vault -- --pack prices` (95 new ids),
then `host-room -- 10 --pack prices` to prove a reveal. Both are live writes, so they wait for Greg.

**Not covered:** whether the office finds it fun, and whether spacing-as-difficulty holds.
The first round is the check. The RPI series end January 2025; the quotes refresh monthly,
so August 2026 is the latest "now" only until 21 October.

## 7 October 2026 — every option under today's price

**The first office round (`XRUE`, 8 seats, 47%) found the hole AC 5 left.** Greg: some questions
had one option under the price the question gives, "and so it was obviously going to be that
one". Measured on the shipped pack: **6 of 95** exactly that; 17 more with two under (a coin
toss); **46 of 95** with an option at or above today's. The ladder was built around the answer at
a balanced place and never looked at today's price; AC 5 had guarded only prices that fell.

**Built (`17946ce`, local).** AC 5 now reads: *where the price rose, every option is under
today's; where it fell or held, the answer is in place 2 or 3 with an option either side.*
`fitLadder` narrows the spacing to fit (never under 12%); `placeAnswers` balances places within
each gap, taking a place one behind where that keeps the level's own spacing. **AC 6 changed
with it**: the level is the spacing actually used — **24 easy / 28 medium / 43 hard**, was
33/32/30. Rounding still comes from the level dealt in turn, so **all 95 answers are unchanged**
(the writer checks against `.cache/hand-vault.json`: 0 changed) and the vault needs nothing.

| After | |
|---|---|
| All four options under today's price | **87** of 95 |
| Got cheaper or held — options straddle it | 8 |
| Answer's place per gap (5 / 10 / 20 / 30 years) | 5-6-7-7 · 7-7-8-8 · 4-5-6-5 · 4-5-5-6 |
| Tests | the three new pack rules fail on the old writer, pass on the new; 1,377/1,377 |

**Not covered.** Whether the round is now too hard: half the pack is hard, and 47% was the
lowest hit rate of any round on the giveaways included. And a player who notices that only
the 8 that got cheaper have options above today's price can narrow those to two or three.
The next office round is the check; `read-games --pack prices`.

### Correction, same day — a decoy over today's price (`c3ec3c6`)

**The rule above made a new giveaway, and the doc's own "not covered" line named it.** Greg,
on `17946ce`: one answer in `XRUE` was higher than today's price. That item was handled, but
once only the 8 that got cheaper had an option over today's price, **seeing one said "this got
cheaper"** — measured: options at or over today's price on 38 rising questions before, 0 after.

AC 5 now reads: *fell or held → the answer is the top option and the only one at or over
today's price; on as many rising questions in the same gap, the top option is a decoy over
today's price; every other option under it.* `pickDecoys` chooses them by hash.

| After `c3ec3c6` | |
|---|---|
| All four under today's price | 79 |
| One option over today's — the answer (fell or held) | 8 |
| One option over today's — a decoy (rose) | 8, matched per gap |
| Levels | 21 easy / 26 medium / 48 hard |
| Answers changed against the vault cache | **0** — no reseed |

The two new pack rules fail on `17946ce`'s writer and pass on this one. **Not covered**, still:
whether the round is too hard now, and whether "did it get cheaper?" lands as a fair question.

## Batch 2 — 17 October 2026

17 Oct: one batch-2 question cut after its options were shown in a transcript; 155 → 154.

**Why.** Live freshness, 17 October: 95 questions, 56 asked, **39 unseen**. The office uses about
16 a week, mostly through Random Round (1–4 Price questions a round): two and a half weeks of
runway. Goal **+60, to 155**. Shape only below — Greg plays it blind.

**Nothing downloaded.** `observed.json` already holds every item's median for the three quote
months and every RPI series for the three Januaries, from the files cached on 6 October.

**Shop quotes only.** Of the 25 RPI series not in the first build, 1 is spoiled, 2 are twins of
items already asked and 22 lack a value in both months of either gap. All 59 are 5- or 10-year
questions, so the pack's mix moves: **114 of 154 at 5 or 10 years**, was 55 of 95.

| Candidates — 360 not in the first build (335 quote items, 25 RPI series) | |
|---|---|
| Not askable: not quoted in the earlier month / description changed / under 30 quotes | 51 / 10 / 2 |
| Not askable: RPI series without both months, or unit changed inside the gap | 22 |
| Twin of an item asked or spoiled (`TWIN_KEYS`: 8 quotes, 2 RPI), or spoiled | 10 + 1 |
| Obscure, or not an everyday purchase | 39 |
| Unit or size too loose to name honestly | 35 |
| Not for an office round | 4 |
| Fits only on top — fell, held or barely rose — cut so each gap's places stay even | 15 |
| Suitable, not needed for +60: a reserve, not reviewed as closely | 111 |
| **Added**, numbered on from the first build; the last, `price-155`, cut since (`SPOILED_KEYS`) | **60 → 59** |

| After the cut | Pack (154) | Batch 2 (59) |
|---|---|---|
| Per gap, 5 / 10 / 20 / 30 years | 53 / 61 / 20 / 20 | 28 / 31 / 0 / 0 |
| Levels, easy / medium / hard | 32 / 31 / 91 | 11 / 8 / 40 |
| Largest category (cap: a quarter) | 24 — 15.6% | 12 — 20.3% |
| Answer's place per gap (5 / 10 / 20 / 30) | 12-13-14-14 · 15-15-15-16 · 4-5-6-5 · 4-5-5-6 | |
| All four under today's / answer over (fell, held) / decoy over | 126 / 14 / 14 | 45 / 6 / 8 |
| Answers changed against the vault cache | **0** — and 59 new ids to seed | |
| Re-laid by the cut: it held a five-year decoy, so that gap's decoys and places moved | 13 options, 8 levels — all five-year | |

**The first 95 keep their slugs, gaps and keys in order** (pinned by hash), so the level dealt
in turn, the rounding and every seeded answer are unchanged. Placing and decoys work per gap,
so **8 of the 95 had their options re-laid and 4 changed level** (8 and 5 after the cut, against
`master`); no answer or wording changed.

**One test bound moved.** "The answer in each place about equally" allowed a spread of 3 per gap
on invented prices that put two in seven where only the top fits — more than a quarter. The
five-year gap is now 54, of which 16 fit only on top, and no placing gets under 4 (an
independent count; 53, 15 and 3 after the cut). The bound is now 3 or that least, whichever is
wider. A placer that always takes the first place still fails it; on the real pack the spread is
2 in the five-year gap and 1 in the ten-year (was 1 in both before the cut).

**New rules, each with a deny case and an allow case.** `twinsIn`: one item once, across sources
and codes, and never a twin of a spoiled one. `prices-pack.test.ts`, on the published file: one
question per spec in the specs' order (fails on the 95-question file against 155 specs), every
gap and level at least 15 times, options low to high at least 12% apart, and at most the top
option at or over today's price. It compares ids and counts, so a failure prints no price.

**Not covered.** Hard is now 59% of the pack, was 51%, and 68% of the batch: most quote items
rose modestly, and every option under today's price narrows their ladders. Whether that is too
hard is for the next rounds — `read-games --pack prices`.

**Before it ships:** `write-prices-pack` in the checkout that seeds, so its `.cache/hand-vault.json`
holds the 59 new answers; then `seed-vault -- --pack prices` and one `host-room` reveal.
