# Higher or Lower — two prices, one call

> **Owner: Greg Rothwell. Last updated: 24 October 2026. Budget: 250 lines.**

**Status: story only, 24 October 2026, branch `higher-or-lower`. Not built,
not approved.** Idea 3 on the 24 October ideas list (chat, 18:30), picked by
Greg the same night: *"Build Higher or Lower next: story first."*

**Treated as blind until Greg says otherwise (D3).** This file, chat, commits
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

**The price behind the answer cannot be shown at the reveal either, today.**
The vault only confirms which *option* is right: a client writes
`{ answer: "Higher" }` and the rules match the string
(`src/lib/vault.ts:81`). There is nowhere for "and it costs £x" to come from.
That is D1.

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
3. **Two options, *Higher* then *Lower*, in that order** (`ordered: true`),
   as two full-width lecterns.
4. **Sealed in the price sense, not only the `correct` sense.** A new test
   fails if any hidden item's key is a shown card anywhere in the pack, is a
   Price Was Right or Price is Right key, or is spoiled — and if any hidden
   item's price string appears in any file under `public/packs/`.
5. **No answer by habit.** *Higher* is right in 45–55% of questions, overall
   and at each level.
6. **Difficulty from how far apart the two prices are**: the closer, the
   harder. No pair closer than a floor, so a near-tie that a different month's
   quotes could flip is not asked. Bands and floor are set at build from the
   measured spread (placeholder: hard 1.1–1.3×, medium 1.3–2×, easy over 2×).
7. **Variety**: no item in more than two questions; no pair asked twice
   either way round.
8. **The reveal lights the right lectern** as on any question. Under D1 (a)
   no price is shown for the hidden item.
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

The seal-in-the-price-sense test (4), the 45–55% balance (5), the band and
floor (6), the variety rule (7) and the two ordered options (3), each in a
`higher-pack.test.ts` beside `prices-pack.test.ts`, written red before the
writer exists. 4 gets one allow case: a Price Was Right item as a shown card
passes.

## Decisions for Greg

| | Question | Recommended | Why |
|---|---|---|---|
| **D1** | Show the hidden item's price at the reveal? | **(a) Not in v1** | (b) needs a new vault field readable only after the window: a rules change, the area of [`postmortem-the-pin-that-refused-the-reveal.md`](postmortem-the-pin-that-refused-the-reveal.md). Build (b) if the first office round asks for it |
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

The run of cards and the streak (seal, above), the price at the reveal (D1),
data other than prices (chart peaks, release years) and a picture per item.
