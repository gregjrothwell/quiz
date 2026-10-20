# The Price is Right — today's price, from a picture

> **Owner: Greg Rothwell. Last updated: 20 October 2026. Budget: 250 lines.**

An office suggestion, brought by Greg 20 October 2026: a "normal" Price is Right round, where you
are shown something and guess what it costs. The sister of [The Price Was Right](price-was-right.md),
which gives today's price and asks for an old one. Pack id `tags`.

**Greg plays it blind** (20 October): no item's price appears in this file, in chat or in a
commit message. Slugs are numbers. Item names live in `scripts/hand-tags-data.ts`, as The Price
Was Right's do, and a price lives only in `.cache/`.

## Greg's decisions — 20 October 2026

1. **Blind.**
2. **Pictures drawn on the MacBook**, not the Mini ("I don't think we finished optimising the mini
   after all the crashes"), with Z-Image-Turbo through mflux, as Catchphrase is drawn.
3. **Greg approves the drawing style** before the set is drawn. The samples are of objects that
   are not ONS items and never go in the pack — a teapot and a watering can — so he can judge the
   look without seeing a question.

## Sources — checked 20 October 2026

**ONS shop price quotes, August 2026** (the file The Price Was Right already caches): the median
of each item's valid quotes that month, at least 30 shops. **No groceries**: the 2026 glossary
says the quotes exclude them. Of the 394 items quoted that month, **278 are not asked by The Price
Was Right**; that is the pool. British by construction.

**Nothing in The Price Was Right may appear here, or anything close to it.** That pack prints an
item's August 2026 price in its question, which is this pack's answer. Left out by meaning as well
as by code: the 40-inch-plus television (so no smaller one), the leather sofa (so no fabric one),
toilet rolls (kitchen roll), the houseplant (a potted shrub), the board game (a card game),
paperbacks (any book), glasses (contact lenses), facial moisturiser (body lotion), hand soap
(shower gel), shampoo (conditioner), the bra (a sports bra), and the four items spoiled on 6
October (haircut, pint of lager, fish and chips, double duvet — so no duvet cover either).

**Packaging is left out where it carries print**: dishwasher tablets, bin liners, plasters,
nappies, wipes, seed packets, bottles of bleach. A drawn label reads as gibberish at best and a
brand at worst.

## Story — for Greg

**As** an office player, **I want** to see a picture of an everyday thing, told what it is, and
guess what it costs in UK shops today, **so that** there is a quick, visual price round anyone can
play from their own shopping.

### Acceptance criteria

1. **A pack in the lobby**, *The Price is Right*, on the show shelf after The Price Was Right. At
   least 60 questions and at least 15 at each level.
2. **Each question shows a drawn picture of the item and names it in plain English**, and asks
   what it typically cost in UK shops in August 2026. Four price options, sorted low to high.
3. **Every price is the ONS median** of that item's valid August 2026 quotes, at least 30 of them,
   computed by script from the cached files. No price is typed by hand.
4. **Nothing The Price Was Right asks, has spoiled, or has a twin of.** A test reads both spec
   files and fails on a shared or twinned key.
5. **Variety.** At least six kinds of thing; no kind more than a quarter of the pack; prices from
   pocket money to big-ticket — at least ten answers under £10 and ten over £100.
6. **No option gives itself away.** All four rounded to one step, chosen from the middle of the
   ladder the player sees, so the rounding says nothing the options do not; at least 12% apart;
   the answer in each place exactly as often, every four questions in spec order.
7. **Difficulty is the spacing** — wider is easier — dealt easy, medium, hard in turn.
8. **Every picture is checked.** No text, label, logo or price tag: Apple's Vision reads each
   drawing and any writing refuses it. `--no-metadata`, so no prompt reaches a published file.
   Claude picks between versions; Greg does not open the sheets.
9. **Sealed and seeded** like every pack: no answer in `public/packs/`, the seal test green, the
   vault seeded and read back, one `host-room` reveal end to end before deploy. **No engine
   change, no rules change.**
10. **Blind**: reports, tests and commits name slugs and counts, never a price.

Not in Random Round. That is Greg's call once the office has played it.

## Built — 20 October 2026, branch `price-is-right`

| | |
|---|---|
| Specs | `scripts/hand-tags-data.ts`: **81**, nine kinds, the largest 13 (16%) |
| Prices | the August 2026 medians already in `.cache/prices/observed.json`; nothing downloaded. **81 of 81 priced**, each from at least 30 quotes |
| Spread (AC 5) | **21 under £10, 39 from £10 to £100, 21 over £100** (5 over £500) |
| Levels | dealt in turn: **27 / 27 / 27** |
| Answer's place 1–4 | **21 / 20 / 20 / 20** — each place once every four specs, the order per block by hash |
| Overlap (AC 4) | `overlapsWithPriceWasRight`: 0 of 81; its deny case refuses an asked key, a spoiled key and a twin of one |
| Writer | `npm run write-tags-pack`; refuses an unpicked spec, a drawing Vision never read, and any writing at all |
| Draw | `npm run tags-draw`: two versions a spec, Vision, contact sheets; **refuses to start until `TAGS_STYLE` is set** |
| Tests | `write-tags-pack.test.ts`, 17, on invented prices; 1,573/1,573 overall |

**The rounding step is read off the ladder the player sees** (`stepForLadder`): the middle of
the four options, finer if the cheapest would have under five steps of room. A step taken from
the answer's own price leaks near a band edge — at £11, two places would round to 10p and two to
50p, and the rounding would say which half the answer is in. The test sits on that edge; with
the step taken from the answer it fails.

**Places are append-stable.** Every four specs in list order use each place once, so adding a
batch, or dropping a spec (`dropped` keeps its slot), moves no earlier answer and the vault needs
nothing reseeded. Two mutations were run: the step from the answer's price fails one test; places
by hash alone fail two.

**Style samples, 20 October:** a teapot and a watering can, each as A (catalogue: pale grey
studio), B (prize podium: navy studio, spotlights, a round podium) and C (flat illustration);
then a garden shed and a motor scooter in A and B, to see whether a podium copes with something
furniture-sized. None is an ONS item; none ships. ~1.5 minutes a drawing on the MacBook.

**Before it ships:** Greg's pick → `TAGS_STYLE`; `npm run tags-draw` (162 drawings, about four
hours, on the charger, lid open); Claude picks a version per spec from the sheets; `write-tags-pack`
in the checkout that seeds; `seed-vault -- --pack tags` and a read-back; one `host-room` reveal;
`tags` added to `SHOW_ROUNDS` once the lobby shelves are on `master`. No engine or rules change.

**Not covered:** whether the drawings read as the thing named, and whether a median is a fair
answer for an item that varies as much as a handbag or a sofa does. The first office round is the
check, `read-games --pack tags`.
