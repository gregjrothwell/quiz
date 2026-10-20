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

## Built — 20 October 2026, branch `price-is-right`, local

*(filled in as it lands)*
