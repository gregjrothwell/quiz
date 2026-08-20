# The final card

> **Owner: Greg Rothwell. Last updated: 20 August 2026. Budget: 250 lines.**

**Status: built 20 August 2026, not deployed.** Chosen from
[`ideas-review.md`](ideas-review.md#7-the-final-card-as-a-png). The story and acceptance
criteria below are as they were agreed; what building it changed is under
[What the story got wrong](#what-the-story-got-wrong).

## The story

> As somebody who has just played, I want to drop the result into the Teams channel, so that
> the people who missed it can see what they missed — and turn up next week.

**Right now the quiz ends and nothing leaves the tab.** For a product that is deliberately an
event rather than a habit, the artefact is the only advertising it has.

## The shape

A **1200 × 630** PNG drawn on a canvas: the pack, the winner, the podium, the chair if the
round seated one, the rosettes, and the date. Handed to the player by whichever of three
routes their browser supports.

## Acceptance criteria

1. A button on the final screen produces a PNG of the round. Available to **everybody**, not
   just the quizmaster — the person who pastes it into the channel is whoever is in the
   channel.
2. **It reads at thumbnail size.** The top three and the winner, not the full standings: a
   fifteen-row table is unreadable in a chat client's preview, and this is the only place the
   card will ever be looked at.
3. **Rosettes appear only when this device saw the whole game.** `sawWholeGame` already gates
   them on screen (`awards.ts`), and the reason applies twice over here: two people pasting
   different cards of the same round into the same channel is worse than neither doing it.
4. **The card is drawn from the frozen snapshot**, like everything else on that screen — so
   somebody pressing Leave cannot change what a card made a minute later says.
5. **Zero Firebase.** No reads, no writes, no rules change. Everything on the card is already
   on the device.
6. **Nothing is downloaded, copied or shared without a press.** The button does one thing when
   pressed and nothing otherwise.

## Four decisions, all taken as recommended

- **Hand-drawn canvas, not a DOM-to-image library.** `html2canvas` and friends are 40–50 kB
  against a 262 kB budget where chunks over 15 kB get split, and they photograph a screen that
  was designed to scroll. Drawing it is a few kB and produces a card that was *composed* —
  which is what gets looked at in a chat window. **Recommend hand-drawn.**
- **Loaded on the press, not in the bundle.** A dynamic `import()` when the button is clicked
  costs nothing to the players who never press it. `Preview` and `Season` already do this with
  `React.lazy`, so the pattern exists.
- **Copy first, then share, then download** — all three **feature-detected, not assumed.** The
  real workflow is *paste into Teams*, which is the clipboard; a phone wants the share sheet;
  a desktop browser that has neither gets a file. **No claim is made here about which browsers
  support which** — the code detects and the button says what it will do.
- **The room code stays off the card.** It is the capability that lets anyone into the room,
  the room lives for thirty days, and the round is over — so printing it buys nothing but a
  way into a dead room, on an image that by design gets forwarded.

## The one that will bite

**Canvas falls back to a system font silently.** The card wants Anton and Chakra Petch, which
the page loads with `font-display: swap`; if the drawing runs before they are ready, it
produces a legible, ugly card and says nothing. `await document.fonts.load(...)` for each face
before the first `fillText`, and it is worth a comment saying why, because the failure looks
like a design problem rather than a timing one.

## Where the code goes

The same split as the awards: **the engine decides what the card says, the drawing decides
what it looks like.**

- `src/engine/card.ts` — `cardModel(...)` returning the pack, the title line, up to three
  podium rows, the chair, the rosette counts and the date. Pure, tested, no canvas.
- `src/lib/drawCard.ts` — takes the model, returns a `Blob`. Dynamically imported.
- `Final.tsx` — the button, the wording, and the three delivery routes.

`cardModel` gets the same inputs `Final` already computes, so nothing new is derived twice:
`roomStandings(players, scores)`, `seatedLast(rows)`, `awardsFor(log, …)` and `sawWholeGame`.

## Tests to write first

In `src/engine/card.test.ts`, before any drawing code:

- A four-player round puts the winner in the title and three rows on the podium.
- A dead heat names both winners and does not invent a second place.
- A round of three seats nobody in the chair, matching `seatedLast`.
- A partial log yields a model with **no rosettes**, not a model with zeros.
- A round nobody scored still produces a card rather than throwing.
- The room code appears nowhere in the model.

The drawing itself is verified in the browser, because a canvas assertion in jsdom tests the
shim rather than the picture.

## What the story got wrong

Five things, all found by building it, and the last two by *looking at the picture* rather
than by a test passing.

- **The lazy import had to become a prefetch, and that is not an optimisation.** Writing an
  image to the clipboard is gated on the transient activation of the press that asked for it,
  and a cold `import()` is a network fetch — on a slow connection the module lands after the
  activation has expired and the card silently degrades to a download on the one press that
  mattered. `Final` now fetches the module when the podium appears. It still does what the
  split was for: nothing is in the main chunk, and a player who never finishes a round never
  fetches it.
- **The import cache is a module-scope variable, not a `useRef`.** There is exactly one such
  module, so a per-instance ref was more state than the problem has — and the React Compiler
  refused to optimise the whole component around a ref mutation it could not follow.
- **`Date.now()` cannot be called in a component, at all.** `react-hooks/purity` rejects it
  in render scope, and a handler defined in the render body counts. That is why `shareRound`
  exists in `drawCard.ts` and assembles the model itself: the module is not a component, so
  reading the clock there is ordinary code. `Final` passes the round and nothing else.
- **The third riser dropped its score out of the bottom of its own box.** The three lines
  inside a riser are laid out from its top and reach 132px; the first draft made third place
  104px tall. Nothing threw, the number was perfectly legible sitting in mid-air below the
  box, and no test could have caught it. `RISER_HEIGHTS` now floors at 152, which is why that
  constant carries a comment saying so.
- **"Konstantin & Alexandra takes the chair."** A shared last place is still last, and two
  people do not *takes* it. Only visible on a card drawn with a dead heat for the chair.

Two of the eight tests were also wrong when first written, and were corrected rather than the
code: an all-zero round makes **everybody** a joint winner, because `Final` has always called
that table a dead heat; and the shared fixture had no review highlight in it, so the assertion
that the review is deliberately left off was passing vacuously.

> **An asymmetry worth knowing, and not this change's to fix.** `seatedLast` refuses to seat
> anybody on an all-zero table — *"a round nobody scored is not a round somebody lost"* — while
> `Final` calls the same table a dead heat. So a 0–0–0 round renders as everybody winning and
> nobody losing, on the screen and now on the card. Asserted in `card.test.ts` rather than
> corrected: the card follows the screen, and changing the rule is a decision about the podium.

## Evidence

`typecheck`, `lint` and `build` clean, **430 tests** (up from 416), no `any`, no
`@ts-ignore`. Fourteen new cases in `card.test.ts`, written first and watched fail.

**The bundle did what it was supposed to, nearly.** `drawCard` splits out at **4.48 kB (2.16
kB gzipped)** and is fetched only on a final screen. The main chunk went 225.54 kB → 226.20
kB — **it was supposed not to move at all**, and the 0.66 kB is the button, its six labels and
the prefetch effect, which live in `Final` and cannot be anywhere else.

**Looked at, not just produced.** Three cards were drawn in the browser and inspected:

| Case | Held up |
|---|---|
| Ordinary round — pack, three risers, chair, three rosettes | yes |
| Worst case — dead heat, 14-character names, four rosettes, a shared chair | yes; the headline and the names shrink to fit |
| Sparse — no pack title, no chair, no rosettes from a partial log | yes; airy rather than broken |

The button was pressed on a real `Final` in the gallery and ran the whole chain, reporting
**"Saved as an image"** — the clipboard was refused in that context and the fallback caught
it, which is the degradation working rather than a failure. No console errors. At 375px the
button is 249px wide in a row that already wraps, with no sideways scroll.

**Not covered:** whether Teams renders it well, which needs Teams; and the clipboard and
share routes have not been seen succeeding, only falling through — a real browser on a real
press is the only place to watch those.
