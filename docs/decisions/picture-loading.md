# Pictures that do not turn up

**Owner: Greg Rothwell. Last updated: 21 September 2026. Budget: 250 lines.**

Bret reported on **Friday 18 September, 15:11** that the On the box pictures
weren't loading, with a screenshot. Others said the same on slow connections.
This is what was actually wrong, what was not, and what was done.

## It was never the files

Checked first, because it is the obvious suspect and it is wrong.

| Claim | Measured |
|---|---|
| The stills are too big | On the box: **82KB median, 158KB max**, 4.3MB for all 54 |
| They are not deployed | **179 of 179** on `gh-pages`, byte-for-byte with the repo |
| Pages is slow or failing | `200`, correct `content-type`, **~0.2s** from Rossendale |

And the decisive one. In the round Bret played — `M9YU`, 18 September 14:04,
six seats — **file size predicts nothing**:

| | n | hit | median |
|---|---|---|---|
| ≥100KB | 4 | 88% | 3.9s |
| <100KB | 11 | 86% | 3.1s |

**So shrinking the images would have fixed nothing.** That is the finding that
kept this from going down a blind alley.

One thing the record does *not* support: Bret was not blind for the whole
round. Eight of the fifteen questions came back **6/6**, which for a player
guessing at four options is about one chance in sixty-five thousand. Worth
asking him whether it was a couple of questions or the lot.

## What was wrong: three faults, compounding

### 1. Nothing was preloaded

The `<img>` was created when the question rendered — **the same frame the
countdown starts in**. On a slow link the download and the answer window were
racing each other.

Every device holds all fifteen questions from the moment the round is built
(`RoomState.questions`), so every filename is known long before the first one is
shown. And the lobby then sits open while people join. That window was free and
nothing was using it.

`useStillPreload` in [`src/lib/stills.ts`](../../src/lib/stills.ts) now pulls
them there, **three at a time in question order**. Not all fifteen: a slow link
is the case this exists for, and firing the lot would put question fifteen's
still in contention with question one's on the connection least able to afford
it. A 404 does not stall the queue behind it.

### 2. The box was zero pixels tall

`.still__img` is `width: 100%; height: auto`. An image that has not arrived has
no intrinsic ratio for `auto` to resolve against, so it was **0px high** — and
`alt=""` meant there was not even alt text in the gap.

Measured in the browser before the fix: a still that had not loaded reported
`height: 0`. After: **448×224**, the right 2:1 box for a 640×320 flag.

That is why this did not read as a picture that was late. It read as a question
with no picture, which is why nobody thought to wait.

The fix is the standard one — `width` and `height` attributes on the `<img>` —
which meant the packs had to learn how big their stills are. See
[`the pack format`](#the-pack-carries-the-size) below.

### 3. A failure was silent and permanent

Nothing listened for `error`. A still that failed once was gone for that
question with no message and no way back.

`useStillStatus` probes the URL — a probe rather than the `<img>`'s own
`onLoad`, because the jigsaw draws its tiles with `background-image` and has no
element to listen to. One hook for both keeps them from drifting, and it costs
no second download.

It retries **once in silence**, then says so and offers a button. The silence is
deliberate: a ten-second answer window has no room for somebody to read a
message, decide and press something.

## The pack carries the size

`imageWidth` / `imageHeight`, read off the file header at build time by
[`scripts/still-dimensions.ts`](../../scripts/still-dimensions.ts). Seal-safe —
a width is not an answer.

All 179 hashed stills were sized **in place**: no id, no hash and no option was
touched, so nothing needed reseeding in the vault.

The headers are parsed in Node rather than shelled out to `sips`, because `sips`
is macOS-only and this runs in `npm test`, which has to work offline and on CI.
**Cross-checked against `sips` over all 179 before any of it was believed: zero
disagreements.** A new measuring tool that has only agreed with itself is not
evidence.

Where the numbers cannot be on the `<img>`, the frame holds the ratio itself —
a jigsaw drawn from background tiles, or Apple's square artwork, which is
fetched at 600×600 by the builder and so needs nothing in the pack to say it is
square. Never both at once: two mechanisms claiming the same box is how they end
up disagreeing. See `frameRatio`.

## What keeps it fixed

- `seal.test.ts` refuses a pack whose still is unsized **or wrongly sized**.
  Checked against the file, not merely for presence, so a still re-cropped
  without a rebuild fails too. **Proved both ways**: breaking one width and
  deleting another named exactly those two questions; restoring them went green.
- Both pack builders measure on the way out and throw if they cannot.
- `PicturePrompt.test.tsx` and `stills.test.tsx` — 21 cases over the box, the
  states and the queue.

## Known limits

- **jsdom does no layout**, so no test here measures a height. The tests pin the
  mechanism; the height was measured in a real browser against the built bundle
  at `:5274`, with the instrument checked first by forcing a value it had to
  report back.
- The dev server on `:5273` had been running since **9 September** and was
  serving twelve-day-old code — `.still__frame` was absent from the page while
  present on disk. Verify against a fresh build, not a long-lived dev server.
  This is the same shape as the stale-CSS-hash trap in
  [`gotchas.md`](gotchas.md).
- The Browser pane's screenshots came back **solid black** while the DOM put the
  element on screen at `top: 258`. The DOM was right, as on 2 September.
- `posterCrop` is wired through the TSX and the CSS and is set on **zero**
  questions in every pack. Dead, and left alone rather than removed while the
  round was being fixed.
