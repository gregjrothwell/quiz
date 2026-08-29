# The rig

> **Owner: Greg Rothwell. Last updated: 28 August 2026. Budget: 250 lines.**

The studio set, and the two cues that operate it. Split out of
[`TOTAL-RECALL.md`](../TOTAL-RECALL.md) on 28 August 2026, when the entry
outgrew the few lines the spine allows.

## What the set is made of

All of it is CSS, in `src/design/global.css`, and none of it is an image:

| Layer | Where |
|---|---|
| Studio wash | `.stage` radial gradient |
| Back wall of light columns | `.stage::before`, masked to fade toward the floor |
| Overhead LED halo | `.stage::after`, most of it above the top of the screen |
| Four beams from the rig | `.beams i`, `blur(18px)`, `mix-blend-mode: screen` |
| Front truss bar | `.stage__inner::before` |

`.beams` is a real element rather than a third pseudo-element because it blends
and drifts independently of the wall behind it, and `.stage` has only two
pseudo-elements to give.

## The rig is operated, from 28 August 2026

Five phases used to share one lighting state. `Stage` now takes a `mood` — only
ever the `Phase`, only from the one call site that is inside a room — and puts
it on `.stage` as `data-mood`. The other five call sites (setup, the gallery, a
connection error, the season board, the landing) pass nothing, which omits the
attribute and lights the set the way it always was.

**All of the effect is in the stylesheet.** Nothing decides anything in the
component, so a lighting change never costs a render.

| `data-mood` | What the rig does |
|---|---|
| `question` | House dims — beams `0.7 → 0.3` |
| `finished` | Beams to `1`, plus a one-shot amber wash |
| everything else | Resting state |

**The dim is the one that is not theatre.** The beams sweep the full height of
the stage behind the lecterns; taking them down removes competing light at the
moment somebody is reading a question and choosing an answer. It comes back at
the reveal, which is when there is something to look at.

## Only opacity moves, and that is a rule rather than a preference

The beams are the most expensive thing on the screen: four layers at 16%×95%,
blurred 18px, blended `screen`. Animating their colour, filter or shadow would
repaint all four **every frame, on a phone, while a clock is running.**

The rule was already in the file before this was written. Classifying all ten
keyframes by the properties they touch:

- **Eight are compositor-only** (`transform` / `opacity`): `pick-in`, `settle`,
  `roll`, `rise`, `lift`, `sweep`, `nervous`, `drift`.
- **Two repaint**, and both are deliberately tiny: `onair-pulse` (a `box-shadow`
  on a 0.5rem dot) and `glow` (a `text-shadow` on four characters).

So: animate `transform` and `opacity`; if you must repaint, repaint something
small. The blaze obeys it by cross-fading a **pre-painted** gradient layer on
`opacity` — the colour never animates.

**No fill mode on `blaze`, deliberately.** `both` holds the final keyframe above
every normal declaration, which is what stopped `.tile--dim` dimming for weeks
([`gotchas.md`](gotchas.md)). None is needed here: the resting state of the
layer is the state the animation ends on.

**`prefers-reduced-motion` needed no new code.** The blanket rule at the foot of
the stylesheet collapses animation and transition durations, so the set still
changes state — it just arrives rather than fades. That is correct behaviour,
not a casualty.

## The alpha was wrong on paper and right on screen

The wash shipped at `0.34` in the first draft and was **invisible**. It read as
a reasonable number in the file and did nothing in the room. `0.6` unmistakably
reads as the lights coming up, and that is the value in the file — chosen
because it was looked at, not because it was between two others.

Safe at that strength because `.beams` is `z-index: -1`, behind the content
column, so the wash cannot reach the contrast of anything anybody has to read.

## Measuring this: `getComputedStyle` lied

**Do not verify the rig with computed style.** During this work the browser
tool's `getComputedStyle` returned a stale snapshot — it reported `.beams` at
`opacity: 0.7` while an inline `opacity: 0.11` was set on the same element,
which is impossible on a live page. That impossibility is the only reason it was
caught; every reading taken that way beforehand was fiction, and one of them
sent a wrong diagnosis ("it must be mid-transition") down a blind alley.

**Screenshots were the only trustworthy instrument.** Two other traps in the
same session, both worth knowing before measuring any CSS here:

- **A stale `index.html` served the previous branch's CSS hash** from the local
  preview — the same shape as the stale-CDN gotcha, on `localhost`. Check which
  sheet the page actually loaded before trusting any reading.
- **Programmatic `.focus()` does not trigger `:focus-visible`.** It reports
  `outline: none` and looks like a missing focus style. Press Tab instead.

## Not verified

That `mood={room.phase}` lights up in a real room. It is typed, and the CSS is
proved in both directions against the built output, but the wiring itself wants
the live round that several other things are already waiting on.

## Turned down, 28 August 2026

- **A verdict wash at the reveal** — green or red across the rig. Cheap to build
  the same way as the blaze, but that screen already carries a green tile, a red
  "not this time", the vote pills and Standings. Also the one idea here with a
  genuine accessibility bound: a **fade** is fine, a **flash** is not, because
  rapid full-screen luminance change runs at WCAG 2.3.1's three-flash
  threshold. If it is ever built, it must be slow by design and not by taste.
- **The rig tightening in the last seconds.** The timer already goes `nervous`;
  a third cue competing for that same moment was judged one too many.
