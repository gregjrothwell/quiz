# The house audio stack

> **Owner: Greg Rothwell. Last updated: 11 September 2026. Budget: 250 lines.**

`src/lib/sound.ts` serves three different rounds and the cues, and the thing
that bit twice is that **it is not one audio system but two**. This file is
about the stack; [`tunes-round.md`](tunes-round.md) is about the round — which
clips give the answer away, the song list, the audit. That one was at exactly
250 of 250 lines when this was written, which is the other reason this is here.

## Two gates, and only one of them was ever unlocked

| | synth cues, Classical (`playSequence`, `startClock`) | Name that Tune (`playPreview`) |
|---|---|---|
| Plays through | Web Audio, an `AudioContext` | an `<audio>` element |
| Level set by | `masterGainFor(volume)` on the master gain | `el.volume` directly |
| Unlocked by | `unlock()` → `ctx.resume()` | **nothing** |

The split is forced: Apple's CDN sends no CORS header, so a preview cannot be
routed through the AudioContext and the master gain cannot reach it. That much
was known and written down on 10 September.

What was not: **browsers gate the two separately.** `unlock()` resumes a
suspended context and does nothing whatever for a media element. A page the
browser has seen no interaction on refuses `el.play()` with `NotAllowedError`,
and until 11 September that rejection went into an empty catch — the question
ran its fifteen seconds in silence with nothing on screen to say why.

### The round that showed it, 11 September 2026

> "Joe said he didn't hear the music on the first question." — Greg

Answers per question in `CUC4`, in order:

```
  7, 8, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 8
  ^  ^  ^
  two silent, then one, then everybody
```

The first question also has the slowest median of the five easy ones — 4.9s
against 2.4–3.0s. **That is an autoplay-unlock ramp, not a coincidence**: people
finding the button one at a time, and it is the shape Joe described from the
inside.

**The likely trigger is the link auto-join.** `shouldAutoJoin` (28 August,
[`joining.md`](joining.md)) puts a regular with a remembered name straight into
the room with no press at all — so when the first question opens, the page has
no gesture on it. The feature that removed a press removed the gesture that
unlocks media. Nobody would ever have connected the two.

### What it does now

`previewBlocked`, module state, published through `useSound`. The question
screen shows a `nudge` above the replay button and the button reads **"Play the
tune"**.

**No new control, and that was Greg's call:** *"We already have a tap to hear
this again button."* It was always there; what was missing was any reason to
press it. The label mattered though — "Hear it again" is a lie to somebody who
never heard it once, which is exactly the player it exists for.

**Only `NotAllowedError` raises it.** A 404 or a decode failure is ours to fix,
and inviting a press that cannot help would be worse than silence. Verified in
both directions: the tests fail when that discrimination is removed.

Two things about the flag's shape, both deliberate:

- **Lowered at the top of every `playPreview`**, not on a successful play. A
  success branch could only ever set false to false, and an untested branch that
  cannot fire is worse than no branch. The cost is the nudge appearing a frame
  after the refusal.
- **Duck-typed on `name`** rather than `instanceof DOMException`, matching
  `isPermissionDenied` in `src/lib/vault.ts`. What matters is what the browser
  called it.

**Not verified end to end in a browser, and worth saying.** The automation
harness grants the page user activation — `navigator.userActivation.hasBeenActive`
was already true — so the block cannot be reproduced there. The flag is unit
tested both ways; the rendering above it is a plain conditional.

## The slider was linear, and hearing is not

> "I noticed the volume adjustment was right at the bottom of the slider.
> Default needs lowering and then the slider needs adjusting for meaningful
> change throughout the range." — Greg, 11 September 2026

This is the second report in two days. On the 10th the default came down from
`1.0` to `0.35`; **that was still too loud**, and the more useful half of the
complaint is the second sentence. Somebody dragging a control to its end stop has
been given the wrong *range*, not just the wrong starting point.

`HTMLAudioElement.volume` is **linear amplitude**. Halving the amplitude is about
−6 dB, so on a linear slider the whole top half of the travel spans 6 dB and
every level worth choosing is crushed into the bottom tenth. The control had
twenty stops and perhaps three of them were useful.

### The travel is now 40 dB

`volumeForPosition` / `positionForVolume` in `src/lib/sound.ts`. At the
control's `step={5}` that is **a flat 2 dB per step, wherever the thumb is** —
which is what "meaningful change throughout the range" means, and the property
a linear control cannot have at any default.

| position | amplitude | |
|---|---|---|
| 100 | 1.0 | full scale |
| 75 | 0.32 | where the old default sat |
| **50** | **0.1** | `DEFAULT_VOLUME`, −20 dB, under a call |
| 25 | 0.032 | background |
| 5 | 0.013 | nearly out |
| 0 | 0 | silent |

The default is **dead centre** on purpose: equal room either side, and the room
has now twice asked for less rather than more.

**The amplitude is what is stored, not the position.** That keeps `setVolume`,
`masterGainFor` and `el.volume` all working in the one unit they actually apply,
and it means anybody who had already tuned this by hand keeps the loudness they
chose — their 0.35 simply shows further up the slider.

### Three things stated rather than left to be found

- **Lowering the default made the cue cap matter more, not less.**
  `masterGainFor` divides by `DEFAULT_VOLUME`, so at 0.35 an uncapped top of the
  slider gave a 0.63 master; at 0.1 it would give 2.2. The cue *balance* is
  untouched either way — that is the whole point of dividing by the default, and
  a round that is not a music round sounds exactly as it always has.
- **The travel has a floor.** A decibel scale never reaches silence, so the
  bottom stop is special-cased to off and an amplitude below −40 dB (0.01) has
  nowhere to sit but position 0. Nobody arrives there from the old control: its
  `step` of 5 made 0.05 the quietest level it could be dragged to.
- **The thumb snaps to the step grid.** A stored 0.35 computes to position 77 and
  the input renders it at 75. Harmless — the stored amplitude is what plays — but
  the unit test asserts 77 and the browser shows 75, so the test says which is
  which rather than leaving the next person to find the disagreement.

### Measured in a browser, against the built bundle

`vite preview` on 5274, **bundle hash checked against the build output first**
(`index-OF8iAc5f.js`) — because on 10 September a stale dev server served the
previous branch's code through two reloads and every reading taken that way was
fiction.

Driving the real control and reading back what was stored:

| slider | stored amplitude | dB |
|---|---|---|
| 100 | 1.0 | 0 |
| 75 | 0.3162 | −10 |
| 50 | 0.1 | −20 |
| 25 | 0.0316 | −30 |
| 5 | 0.0126 | −38 |
| 0 | 0 | silent |

Even 10 dB a quarter turn, the whole way down. And with `vibequiz.volume` preset
to the old `0.35`, a reload leaves the stored value **untouched** and moves the
thumb to 75 — the loudness somebody already chose survives the change.

## Still open

1. **Nobody has played a round at −20 dB yet.** Two reports in two days both said
   "quieter"; whether centre is the right place for the default is a question the
   next round answers.
2. **The mid-clip live adjust was not re-verified in a browser** for this change.
   `setVolume` still writes `previewEl.volume` and that wiring was not touched —
   only the value arriving at it — and the unit test covers it. The design
   gallery's tune fixtures do not drive `playPreview`, so there was no cheap way
   to exercise it there.
3. **Safari is untested.** Its autoplay policy is stricter than Chrome's and may
   refuse a media element even after a gesture, in which case the nudge would
   show on every question rather than the first.
