# The Price Was Right — then and now

> **Owner: Greg Rothwell. Last updated: 6 October 2026. Budget: 250 lines.**

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
