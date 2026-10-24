# Higher or Lower — two prices, one call

> **Owner: Greg Rothwell. Last updated: 25 October 2026. Budget: 250 lines.**

**Status: built 25 October 2026 on branch `higher-or-lower`, 90 questions,
not seeded, not live.** Greg: *"Approved with D1–D4 as
recommended: no price at reveal in v1, fixed 10s, blind, not in Random
Round."* **D1 then changed the same night to (c)**, the price inside the
buttons: Greg asked *"why aren't we showing price at reveal?"*, was given
(a), (b) and (c) with (c) recommended, and answered *"ok"*, read as (c).
Idea 3 on the 24 October ideas list (chat, 18:30), picked by
Greg the same night: *"Build Higher or Lower next: story first."*

**Blind (D3).** This file, chat, commits
and PRs give counts and slug numbers only: no item next to a price, and no
sample question.

## Why

The idea as pitched: Play Your Cards Right. A run of numbers, *is the next
one higher or lower?*, two buttons, a short clock and a streak, reusing the
price data. Two reasons it is worth a round:

- **Text questions do worst.** `read-games -- --last 40`, 24 October: text 48%
  right, picture 64%. A two-way call anyone can make from their own shopping
  is a text round that is not a trivia test.
- **The data is already here, and British by construction**: ONS shop price
  quotes, UK shops ([`price-was-right.md`](price-was-right.md#sources--checked-6-october-2026)).

## What the pitch cannot keep, and why

**The run of cards cannot be built without leaking answers.** In a chain, card
*n + 1* shows the price that answers question *n*. Packs are static files
anyone can read ([`vault.md`](vault.md)), so the pack would hold every answer
but the last. `seal.test.ts` would not notice: it looks for `correct`, not
for a price in the next prompt.

**The price cannot come out of the vault at the reveal.** The vault only
confirms which *option* is right: a client writes `{ answer: "Higher" }` and
the rules match the string (`src/lib/vault.ts:81`). So **the price goes in the
option** (D1 (c)): the two lecterns read *Higher, £x* and *Lower, £y*, one of
them the hidden item's real price, and the reveal lights it as The Price is
Right lights its answer. No rule changes.

**The decoy is the real price mirrored about the shown one**
(shown² ÷ real, rounded on the same step). Both options are then the same
distance from the shown price, so neither looks nearer, further or rounder:
picking the plausible price *is* calling the direction. A cap on how far
apart the prices may be keeps the mirror believable.

**So version one is a round of separate pairs.** Each question is one shown
price and one hidden item. The streak is out of version one too: it is a
scoring change, and the Commentator or the rivals caption can say it later.

## Measured — 24 October 2026

From `.cache/prices/raw/quotes-202608.csv` (the file `prices-fetch` already
keeps), counted against the live spec lists by importing them
(`PRICE_SPECS`, `TAG_SPECS`, `SPOILED_KEYS`):

| | Items |
|---|---|
| August 2026 shop-quote items with ≥ 30 valid quotes | **392** |
| Keys used by The Price Was Right, The Price is Right, or spoiled | 241 (154 + 81 + 6) |
| **Unused by either pack** | **192** |

The instrument was checked: a first count by regex found 6 used keys, which
the 154 + 81 in the handover rule out; importing the lists gives 154 and 81.
Not yet measured: how many of the 192 can be named in plain English (the ONS
descriptions read like `PUB -HOT MEAL`), and how the pairs fall across the
difficulty bands.

## Which prices may appear where

The hidden item's price must be in **no** published file, or the question is
answered by reading another pack.

| Item from | As the shown card | As the hidden item |
|---|---|---|
| The Price Was Right (today's price is in its pack) | **Yes** — already public | **No** |
| The Price is Right (today's price is its answer) | **No** | **No** |
| Spoiled keys | No | No |
| The 192 unused | Yes | Yes, if never a shown card anywhere |

## The story

> **As** an office player,
> **I want** to see what one everyday thing costs and call whether another
> costs more or less,
> **so that** there is a quick round anyone can play from their own shopping,
> with no trivia to know.

## Acceptance criteria

1. **A pack called Higher or Lower in the lobby**, id `higher`, at least 60
   questions and at least 15 at each level.
2. **Each question names the shown item, its August 2026 price and the
   month, then names the hidden item** and asks if it costs more or less.
   Prices are ONS medians of at least 30 valid quotes, as
   `prices-core.ts` already computes.
3. **Two options, *Higher, £x* then *Lower, £y*, in that order**
   (`ordered: true`), as two full-width lecterns. £x is over the shown price
   and £y under it.
4. **Sealed in the price sense, not only the `correct` sense.** A new test
   fails if any hidden item's key is a shown card anywhere in the pack, is a
   Price Was Right or Price is Right key, or is spoiled — and if any hidden
   item's name appears in another question of this pack or of either price
   pack.
4a. **No tell between the two prices**: in every question both options are
   the same distance from the shown price (as a ratio), to within the
   rounding step, and share its format.
5. **No answer by habit.** *Higher* is right in 45–55% of questions, overall
   and at each level.
6. **Difficulty from how far apart the two prices are**: the closer, the
   harder. No pair closer than a floor, so a near-tie that a different month's
   quotes could flip is not asked. Bands and floor are set at build from the
   measured spread (placeholder: hard 1.1–1.3×, medium 1.3–2×, easy 2–4×,
   and nothing over the 4× cap).
7. **Variety, and a hidden item once only.** A shown card in at most two
   questions; no pair asked twice either way round. **A hidden item is in
   exactly one question**: hidden twice, its real price is the one value both
   questions' options share (found writing the tests, 25 October).
8. **The reveal lights the right lectern** as on any question, and that
   lectern carries the hidden item's real price.
9. **Scoring unchanged**: 500 + rank, wager and steal as on any pack.
10. **The clock (D2)** is the pack's own: 10 seconds via `fixedDurationFor`,
    as Name that Tune does. The answer-window rule reads `durationSecs` from
    the room, so no rule changes.
11. **Not in Random Round** until Greg says (D4).
12. **Seeded before it ships**: `seed-vault -- --pack higher`, read back
    *n*/*n*; `host-room` on two of its ids reveals from the vault.
13. **Release-day lines**: a What's new line, `NEW_UNTIL.higher` = go-live +
    14 days.
14. **Plain British names**, written by hand from the ONS descriptions, under
    the [`AGENTS.md`](../../AGENTS.md) rule.
15. **The live check is the first office round**: `read-games --pack higher`,
    % right per level. Outside 55–85% overall means re-band, not ship more.

### Tests first

Written red, 25 October 2026, before any of it exists:

- `scripts/higher-core.test.ts`: the band, floor and cap (6), the mirrored
  decoy (4a), the two options (3), on invented prices.
- `scripts/write-higher-pack.test.ts`: the builder on invented prices —
  the answer is the real price (8), it refuses an unbalanced list (5) and a
  hidden item under 30 quotes (2).
- `scripts/higher-pack.test.ts`: the specs and the published pack — keys and
  names (4), variety (7), counts (1), shape and no tell (3, 4a), with one
  allow case: a Price Was Right item as a shown card passes.
- `src/questions/higher.test.ts`: the pack id, its title, 10 seconds (10),
  no sound, not in Random Round (11).

5 is enforced by the builder, not read off the pack: which option is right
is not in the published file, by design.

## Built — 25 October 2026

`hand-higher-data.ts` (162 items named by hand, 90 pairs), `higher-core.ts`,
`write-higher-pack.ts` (`npm run write-higher-pack`), `public/packs/higher.json`.
**90 questions, 30 a level, Higher right in exactly 15 of each 30.** 84 of the
90 pairs share an ONS division (clothes with clothes, pub with pub); 42 shown
cards are Price Was Right items. Pairing was a scratch script that printed
counts only.

- **Twins leak too.** The name check caught two hidden items that The Price
  Was Right asks under an RPI key. `TWIN_KEYS` held six more, under different
  names. `leaky()` now follows twins both ways, and a twin is never hidden.
- **The keyboard hint said A–D** over two lecterns. It now names as many
  letters as there are (`QuestionScreen.test.tsx`).
- **AC3, read in the preview** (`#/preview`, two invented entries): on a
  phone the two lecterns stack full width; on a desktop they sit side by
  side, Higher left, as the lectern grid lays any two out. Left as is.
- Two count guards bumped: 23 pack files (`seal.test.ts`), the hand-built
  list (`write-hand-packs.test.ts`). `tv-themes` bumps the same two: at the
  release merge they become 24 and both ids.

**Release day**, in order: a What's new line (`src/lib/updates.ts`),
`NEW_UNTIL.higher` = go-live + 14 days, `seed-vault -- --pack higher` and read
back 90/90, then `host-room --pack higher` on two ids. Counts and slugs only
in chat, commits and the PR.

## Decisions for Greg

| | Question | Recommended | Why |
|---|---|---|---|
| **D1** | Show the hidden item's price at the reveal? | **(c) In the buttons** — decided 24 Oct, replacing (a) | (a) showed no price. (b), a vault field readable after the window, is a rules change in the area of [`postmortem-the-pin-that-refused-the-reveal.md`](postmortem-the-pin-that-refused-the-reveal.md). (c) needs no rule and shows the price |
| **D2** | Clock | **10 seconds, fixed** | The pitch said a short clock; a two-way call needs no more, and `fixedDurationFor` exists |
| **D3** | Blind? | **Yes** | It is price data, like the two packs you play blind |
| **D4** | In Random Round? | **Not yet** | Same as The Price is Right: after its first office round |

## Risk

**Two options halve the guessing floor.** A fast tapper is right half the
time and takes the rank bonus when right. The first office round shows
whether it plays as a coin toss: compare each player's % right here with
their own % on four-option packs (`audit-players`). If it does, the fix is
a scoring decision, not a data one.

## Out of version one

The run of cards and the streak (seal, above), data other than prices (chart peaks, release years) and a picture per item.
