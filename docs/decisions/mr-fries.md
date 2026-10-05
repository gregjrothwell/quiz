# Mr Fries — a house character, and pictures that move

> **Owner: Greg Rothwell. Last updated: 5 October 2026. Budget: 250 lines.**

Greg's idea, 5 October 2026: the show's Mr Chips was a gold robot in most
puzzles; ours would be **Mr Fries, a chip**, in most *new* Catchphrase pictures,
**not the 30 already shipped**. He also remembers the show's pictures moving a
little, and asked what that adds to the drawing pipeline. This is the PLAN-mode
research. **Nothing is built and nothing is decided.** No puzzle answers appear
here.

## The three questions, as asked

1. **One character across many drawings.** Z-Image-Turbo, prompted alone, has
   no reference image to hold a face. Does `mflux` offer one, or is Mr Fries
   drawn once and composited into scenes?
2. **Movement, cheapest first:** CSS on layers → a few frames → a local
   image-to-video model.
3. **What ships:** a moving file must pass the same seal as a still.

## 1. Holding one character

What the installed `mflux` **v0.20.0** can do with Z-Image-Turbo, read from
its own docs at the `v.0.20.0` tag and checked against `--help` locally,
5 October 2026:

| Route | What it is | Cost | Verified |
|---|---|---|---|
| **Prompt only** | One fixed description of Mr Fries in every prompt | Nothing new | Measured below |
| **img2img** | `--image path STRENGTH` (default 0.4) starts from a picture | Nothing new | Docs: "img2img, LoRA and quantizations are supported" |
| **A Mr Fries LoRA** | `mflux-train` with `"model": "z-image-turbo"`; mflux loads ostris's turbo training adapter itself | 10–20 good Mr Fries pictures to train on; time and memory **not documented** | Docs + `training_adapter/` in the installed package. Apache 2.0 |
| **ControlNet pose** | `mflux-generate-z-image-controlnet`, Fun ControlNet Union 2.1: pose, depth, canny from an ordinary picture | Another download; the docs say it is soft at 6 steps and clean at about 20, so about twice the time a picture | Docs. Apache 2.0 |
| **A reference-image edit model** | `mflux-generate-flux2-edit --image-paths fries.png scene.png` on **FLUX.2-klein-4B** | **~15 GB** download, and a second model whose look has to match the 80s house style | Docs; HF API: Apache 2.0, not gated |

Turned down on licence: **FLUX.2-klein-9B** (HF API: `license: other`, gated).
FLUX.1 Kontext and Fill are the FLUX.1-dev non-commercial family. Not read in
detail, because klein-4B does the same job under Apache 2.0.

**Composited instead of drawn:** Mr Fries could be drawn alone a few times
(waving, pointing, shrugging) on the house style's plain dark background, cut
out, and pasted into scenes drawn without him. That gives perfect consistency
and a separate layer to move. The catch: he is then a bystander, and in the
show Mr Chips was often *doing* the puzzle. Pasted-in poses can point at a
phrase; they cannot ride the bicycle in it.

**Cutting him out needs nothing new.** Apple Vision's
`VNGenerateForegroundInstanceMaskRequest` separates "noticeable objects" from
the background on macOS 14 and later (Apple's docs, read 5 October 2026), and
this Mac runs 26.0.1. `sleeve-audit` already reaches Vision through
`uv run --with pyobjc-framework-*`.

## 2. Movement

Cheapest first.

**a. CSS on layers.** Mr Fries is a transparent PNG over the still and CSS bobs
him. It costs nothing to render and makes the smallest files. But it needs a new
pack field (the sprite and where it sits), a change to `PicturePrompt`, and
**one gotcha found today:** the blanket `prefers-reduced-motion` rule at the foot
of `global.css` shortens `animation-duration` without stopping the loop, so an
infinite bob would flicker rather than stop. The sprite would need its own
`animation: none`.

**b. A few frames, built into one animated WebP.** `ffmpeg`, `img2webp` and
`cwebp` are already installed. Frames could come from:
- **the cut-out, transformed**: a squash and stretch anchored at his feet.
  *Corrected the same afternoon:* a first draft said a stretched figure always
  covers the original, so nothing needs filling. That holds only for a convex
  shape; an arm held out would leave a ghost. So the place where he stood is
  filled first (OpenCV inpainting) and he is redrawn over it. Tried below.
- **seeded img2img at low strength**: the same still redrawn a few times so the
  lines "boil", like hand-drawn animation. Not tried. It risks the picture
  changing between frames, which in a puzzle is a clue changing.

The appeal of (b) is that **the client barely changes**. An `<img>` plays an
animated WebP, and `seal.test.ts`'s `HASH_FILE` already accepts `.webp`. The one
change is reduced motion: an `<img>` cannot be paused by CSS, so it needs a
`<picture>` with a `prefers-reduced-motion: reduce` source pointing at the
still.

**c. A local image-to-video model.** Researched, not tried.

| Model | Licence | Size | On a 24 GB M4 Pro |
|---|---|---|---|
| Wan 2.2 TI2V-5B, through `mlx-video` (MIT) | Apache 2.0 (HF API) | 5B | **Unknown.** mlx-video's own README gives no memory or time figure for it. A third-party page (Rapid-MLX, undated) says q8 needs **32 GB**: **placeholder**, unconfirmed |
| LTX-2.5 | LTX-2 community licence, not read | **67.7 GB** q8 download (same placeholder page) | Out on size alone |

The same page timed a different model at **338 s for one second of video** on
an M3 Ultra, a much bigger GPU than this Mac's (placeholder). A video model
would also **redraw every frame**: the flat 80s look may drift, and lettering
could appear anywhere in any frame, so the Vision text check would have to read
every frame rather than one picture.

## 3. What ships

- **The seal holds for WebP as it stands**: hashed name, `.webp` accepted, and
  the byte scan for `mflux|prompt|z-image` reads any file. **To check when one
  is built:** that `img2webp` copies no text chunks from the source PNGs.
- **The size cap is 280 KB a still** (`MAX_STILL_BYTES`). An animated WebP has
  not been measured against it yet. Flat colours compress well.
- **Lettering**: one picture to read today; a frame-built WebP is the same
  picture over again, so reading the base still is enough. A video is not.

## Measured — 5 October 2026

All local, all in `.cache/mr-fries/` (git-ignored): `draw.sh`, `cutout.py`,
`frames.py`, the six PNGs, `sheet.png`, and two animated WebPs.

**Prompt only, six scenes, one seed each.** The house style, then one fixed
description: a golden chip, big round eyes, a wide smile, white gloves, red
trainers and a red bow tie. Then an ordinary scene with no saying in it, so
nothing can spoil the pack: waving, reading on a bench, on a bicycle, watering
flowers, pointing at a house, jumping by the sun. **651 s for the six, 108 s
each** (the 2 October rate).

| | Held in |
|---|---|
| Golden body, round eyes, smile, white gloves | **6 of 6** |
| Red trainers | 5 of 6 (one pair red and white) |
| Red bow tie | **3 of 6** |
| Body shape | Drifts: bean (1, 4), slim (3), crumbed "nugget" (5, 6) |
| Legs | 5 of 6 (4 has floating shoes) |
| Lettering | **None**: Vision read no text on any of the six, newspaper included |

**Read by eye (Claude): recognisably the same chap in all six, and he takes
part.** He reads, rides, waters and points, which a pasted-in cut-out cannot do.
He looks more like a potato than a British chip, and the texture ignores the
style's "no texture". Both are wording to try, not model limits. **The draw
script already makes three versions per phrase and one is picked**, so "most
on-model Mr Fries" becomes part of that pick at no extra cost.

**Movement: the cut-out and stretch, on 1 and 5.**
- Vision isolates him **only when he stands apart from things**. It found one
  figure in five of the six, but on the bench and the bicycle that figure is
  him *and* the object. In 5 it found two (the house, him); he was
  picked by colour (89,749 golden pixels against 100), and it left his
  floating shoes out.
- Six frames, a breath in and out at 10 fps: **81 KB (1) and 94 KB (5)**,
  against the 280 KB still cap. Byte scan: no `mflux|prompt|z-image`.
- **`img2webp` drops PNG text, proved both ways:** a canary in a PNG's text
  chunk was found in the PNG and not in the WebP built from it.
- By eye: on a plain background it reads as breathing, with no ghost. On 5 the
  shoes stay still, and the filled gap leaves a faint smudge by the right arm.
  Fine at quiz speed, not at a close look.

## What this says — Claude's reading, for Greg to decide

1. **Consistency: prompt-only plus the existing pick-of-three is the first
   version.** No new model. Tighten the description first; train a LoRA
   (Z-Image-Turbo, Apache 2.0, already in `mflux`) only if the drift still shows
   once he is in real puzzles.
2. **Movement is charm, not puzzle.** A breathing chip does not change what
   the picture says. The cheap version works but only where he stands clear,
   and it costs a build step plus a `<picture>` for reduced motion. The show's
   kind of movement, where he walks in and does the thing, is video, which on
   this Mac is unmeasured and probably out of reach (above).
3. **Nothing here touches the 30 shipped pictures, the rules or the vault.**

## Greg's answer, and four bodies — 5 October 2026

**Greg:** torn. He likes the character, and it "does look similar to Mr Chips".
He also wonders whether it should have been **a microchip, because that was
the original play on words**. He needs to see options, and the name and the
joke have to be weighed too. **Movement: not yet.** Stills first, to see
whether the office likes him.

**The pun is documented, second-hand.** UKGameshows, read 5 October 2026: he
"was christened Mr Chips for the UK release because, according to Challenge's
2019 documentary 'TV's Greatest Game Shows', he resembled a computer chip." The
US original called him Herbie.

**Four bodies, two scenes each, seed 7.** No name in the prompt, because a name
invites lettering and biases the look. The same face, gloves and trainers on
every one. `draw-options.sh`, `options/`, `options-sheet.png`. Vision read no
text on any of the eight; about 110 s each.

| | Body | By eye (Claude) |
|---|---|---|
| A | Bean | Now a plain potato. Friendly, and holds across both scenes, but nothing says chip |
| B | Chip-shop chip | Reads as a chip at once; holds. A thin stick leaves a small face, and he bends on the bicycle |
| C | Black microchip | Reads as a microchip at once, with **the strongest silhouette of the four**; holds. A robot is what Mr Chips was, and this is not one. Black on the house style's dark background survives on its grey edge and pins |
| D | Gold processor chip | **Came out as SpongeBob SquarePants, twice.** Turned down: another studio's character |

**D is a lesson for every future drawing:** yellow, square, big eyes and gloves
pull the model towards a famous character it has seen. The by-eye read of each
drawing has to look for **look-alikes of real characters**, not only for
lettering.

### Names, and what each one's joke is

| Name | Body | The joke |
|---|---|---|
| Mr Fries | A or B | Mr Chips → chips → fries: a pun on a pun. "Fries" is the American word in a British office |
| **Chippy** | B or C | British for the chip shop, *and* a little chip. On C, a microchip who sounds like the chippy: both meanings at once |
| Mr Bytes | C | Byte/bite, tech that sounds like food |
| Mr Chips | any | The show's own name. Not ours to take |

**Claude's pick, for Greg to overrule:** C, called Chippy. It is the original
pun played straight, the silhouette holds best, and it is not a copy of the
show's robot.

## Chosen — 5 October 2026

**Greg: A, the bean. Keep the others for backup.** He named no name, so he
stays **Mr Fries**: his first name, and it is never drawn or prompted, so it
can change for free.

The wording that drew him, verbatim (seed 7, with `CATCHPHRASE_STYLE` first):

> A cartoon character whose whole body is a single smooth rounded golden-yellow
> potato chip shaped like a bean, flat colour with no crumbs or speckles. It has
> two big round white eyes with black pupils, a wide happy smile, thin black
> stick arms with white cartoon gloves, and thin black stick legs with red
> trainers.

**Backups**, the same face, gloves and trainers sentence after each:
B *"…a single long straight thick-cut British chip-shop chip with square flat
ends, pale golden-yellow, smooth flat colour with no crumbs or speckles,
standing upright like a tall stick."* · C *"…a small black rectangular computer
microchip, with a row of short shiny silver metal pins sticking out along each
long side, flat colour."* (C pairs with the name Chippy.) Drawings in
`.cache/mr-fries/options/`, local only; the words above are the durable copy.

### The story — for Greg to approve

> As the quizmaster, I want Mr Fries in most new Catchphrase pictures, doing
> the thing the phrase describes, so the round has a house character the way
> the show had Mr Chips.

1. **One description, one place.** The wording above is a constant beside
   `CATCHPHRASE_STYLE`; a spec opts in with `fries: true`, and `promptFor` puts
   him after the style and before the scene. Scenes call him "the character".
   His name is never in a prompt, because a name invites lettering.
2. **The 30 shipped pictures are untouched.** A test pins a hash of their 30
   prompts, so no change to the style, to him or to `promptFor` can quietly
   alter what a redraw of them would give.
3. **Most, not all:** more than half of any new batch has him. He is left out
   where he would crowd the clue.
4. **The pick of three now checks him as well**: golden bean, round eyes,
   smile, white gloves, red trainers, and **no look-alike of a famous
   character** (D's lesson). Vision's text read and the seal stay as they are.
5. **Builds nothing visible on its own.** The first pictures with him arrive
   with the next batch of puzzles, the harder-puzzles story, which waits on
   Bonus Catchphrase being played.
6. `typecheck`, `lint` and `test` are clean. No rule, vault or client change.
