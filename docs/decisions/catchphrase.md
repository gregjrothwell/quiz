# Catchphrase — say what you see

> **Owner: Greg Rothwell. Last updated: 2 October 2026. Budget: 250 lines.**

A picture round where each question is a cartoon of a well-known saying or
title, Roy Walker style. **Being built on `catchphrase-round`; not live.** This
file holds the plan, the trial that settled where the pictures come from, the
format, and the story.

**No answers in this file, on purpose.** Greg plays the round and reads these
docs. The puzzles live in `scripts/hand-catchphrase-data.ts` only.

## Why this round

Read off live Firestore with `read-games -- --last 30`, 2 October 2026: of the
last 28 kept rounds, **15 were picture rounds, 6 music, 7 text.** On the box is
the most-played pack, 7 of the 28, and six of those seven scored 83–90% (the
seventh, four seats, 60%). The office keeps choosing rounds it can get, where
the rank race decides. So four options making a puzzle "too easy" is **not** a
reason to build typed answers, which would need a new vault shape and a rule
paste ([`round-types.md`](round-types.md) — the vault compares one option
string).

**It costs no Firebase and no paste.** It is a hand-built picture pack, a hashed
still and four options, drawn by `PicturePrompt` as it stands. `packId` is any
string of 64 or fewer characters (`firestore.rules:712-713`), and question ids
are a sha1 of the slug (`stableId`, `scripts/write-hand-packs.ts:45`), so
neither leaks the phrase. Read 2 October 2026.

## Where the pictures come from — decided 2 October 2026

| Option | Verdict |
|---|---|
| Emoji and words, composed at build | **Turned down by Greg** — "sounds bad" |
| A paid image API | **Turned down by Greg** — a key and a bill are too much |
| The programme's own pictures | ITV's copyright. No |
| **A free model on Greg's Mac** | **Taken** — trialled below |

**The model is Z-Image-Turbo, run through `mflux`.** Checked 2 October 2026:
Apache 2.0 and **not gated**, so no account or token is needed (Hugging Face
model page). 6B parameters, 8 steps by its makers' count (mflux's example uses
9), "fits comfortably within 16G VRAM". The download is **32.9 GB**, summed from the Hugging Face API file tree.
The Mac is an M4 Pro with 24 GB and had 124 GB free.

```bash
uv tool install --upgrade mflux
mflux-save --model z-image-turbo --quantize 8 --path ~/.cache/mflux-saved/z-image-turbo-q8
mflux-generate-z-image-turbo --model ~/.cache/mflux-saved/z-image-turbo-q8 \
  --base-model z-image-turbo --steps 9 --width 1024 --height 768 \
  --seed 1 2 3 --no-metadata --prompt "…" --output scene.png
```

**Do not quantise at load.** `-q 8` on the first run held **28 GB on a 24 GB
Mac, with about 25 GB of swap and about 70 s a step**, so about ten minutes a
picture. Saving an 8-bit copy once fixed it: peak 17.5 GB during the save,
10 GB on disk, then **11–13 s a step**. That is 330–346 s per phrase for three
versions at 1024×768, so a 30-phrase pack takes about **2.8 hours** of Mac time.

**The Turbo model ignores guidance and the negative prompt.** In mflux's own
words: "guidance is forced to 0.0" and "the negative prompt is never encoded".
So everything, including "no writing", goes in the prompt itself.

**Disk afterwards:** 31 GB in `~/.cache/huggingface` plus the 10 GB saved copy.
**Untested:** whether the saved copy runs with the Hugging Face cache deleted.
Check that before freeing the 31 GB.

## The trial — 2 October 2026

Five phrases, three versions each, then two prompts rewritten. All 21 pictures
were checked by eye and by Apple's Vision text reader, the same call
`sleeve-audit` makes.

| Phrase | Reads as the phrase | Note |
|---|---|---|
| The elephant in the room | 3 of 3 | Clay 3D, the look the revival has |
| Hit the nail on the head | 2 of 3 | Version 1 has a stray second hammer head |
| Butterflies in your stomach | 3 of 3 | The see-through tummy worked; came out flat 2D |
| Once in a blue moon | 3 of 3 | "ONCE" spelled right every time |
| Raining cats and dogs | **0 of 3**, then **3 of 3** | The animals sat on the street until the prompt changed |

**Greg, 2 October:** "looks good — they seem a bit easy but that's to be
expected for the test run." He prefers **the old programme's aesthetic** but is
happy with this format. Phrases are to draw on **the Roy Walker era, not the
revival.**

### The rules the trial produced

1. **Style first.** The first batch mixed flat 2D and clay 3D under the same
   wording. Leading with "3D clay-style cartoon render, soft studio lighting,
   plain background" put both rewrites in one look.
2. **Lead with the thing that makes the joke.** "A storm cloud over a town
   street … along with streaks of rain" drew ordinary rain and grounded pets.
   "Cats and dogs tumbling … out of a storm cloud … there are no water drops and
   no ground" drew the phrase.
3. **Describe the scene, never the phrase.** Asking for the saying invites the
   model to letter it into the picture, which is the sleeve problem again
   ([`sleeves-gate.md`](sleeves-gate.md)).
4. **Lettering appears only where asked.** Vision read `ONCE` at 1.00 on the
   three blue moons and nothing on the other 18. That is a filter, not a gate:
   it missed a third of the sleeve titles, so **Greg looks at every picture.**
5. **`--no-metadata` keeps the prompt out of the file.** Checked against a
   control: the same search finds "elephant" in the JSON sidecar and not in the
   PNG. **Without the flag the prompt ships.** A probe drawn without it, 2
   October 2026, carried its prompt in the PNG *and*, through
   `compressStill`'s `sips` pass, in the JPEG. `seal.test.ts` scans every
   published still for it, and that scan found the probe's in both files.

### The old programme's look — chosen 2 October 2026

The same three scenes were redrawn with a 1980s computer-graphics prefix (flat
colours, thick outlines, no shading, dark background). Elephant 3 of 3; nail 3
of 3, though the man always holds the hammer himself; cats and dogs 2 of 3, the
third too sparse. Vision read nothing on any of the nine, at the same speed,
338–346 s a phrase. **Greg: "80's is the better look."** It leads every prompt
as `CATCHPHRASE_STYLE`.

## What the old programme was

From [UKGameshows](https://www.ukgameshows.com/ukgs/Catchphrase), read 2
October 2026: ITV from January 1986 with Roy Walker, made by TVS with Action
Time. Contestants buzzed in on computer-animated puzzles showing phrases,
sayings and titles. **Bonus Catchphrase** hid a picture under nine squares
removed at random. **Super Catchphrase** was a 5×5 grid. Many animations
starred a robot, Mr Chips. The 2013 revival moved to 3D CGI and mostly
celebrity contestants.

**Taken from it:** everyday British sayings plus 80s and 90s titles, drawn
literally, sometimes a picture with a word or a number. **Not taken:** the
programme's pictures, Mr Chips, or its music. Only one example of the
programme's own phrases could be sourced; the rest are written in its style.

## How a question plays — decided 2 October 2026

**Greg:** providing options "will make it obvious which is the correct option
— one answer will obviously stand out as a catchphrase". He is right:
four options turn *say what you see* (recall) into *pick the one that fits*
(recognition), which is far easier. Same-subject wrong answers blunt it but do
not remove it.

**Decided: the picture plays alone for half the clock, then the options
land.** Whoever has worked it out taps the moment they appear and takes the
rank bonus (500/400/300/200, then 100); whoever needs them is reading and
matching, and slower. A right answer still scores the 500 base either way.

- **Built in the client only.** `src/engine/optionsHold.ts` times it off the
  room's shared clock, like the song clue, so the options land together on
  every screen. Until then the lecterns are dark and **empty** — the words are
  not in the page — and the `A`–`D` keys do nothing. No rule, no paste.
- **A late joiner sees the options at once.** Their clock counts from their own
  arrival, so a hold on it could outlast the room's, and they are ranked as
  though they answered on the buzzer anyway.
- **The measurement** is the first round: `read-games` shows whether answers
  bunch at the moment the options land (people who knew) or spread across the
  second half (people matching). The hold is `OPTIONS_HOLD_SHARE`, one number.

**Turned down for now.** *Call it* — a button during the picture-only half that
commits you before you see the options, with a bonus if right and a loss if
wrong. It is the next step if the hold is not enough, and needs a rules paste
for the new answer field. *Typed answers* — the real thing, but a new answer
shape and paste, matching that forgives variants, disputes when it is wrong,
and a typing race on phones. Greg picked the hold.

## The story — approved 2 October 2026

> As the quizmaster, I want a Catchphrase round of cartoon pictures of
> well-known sayings and titles, so that the office gets a picture round that is
> a puzzle rather than a memory test.

**Acceptance criteria** — as approved, with the two changes marked.

1. The lobby offers a pack titled **Catchphrase**, blurb *Say what you see. The
   options wait until halfway.* Hand-built, **30 puzzles**, 8 easy, 14 medium and
   8 hard. *As it comes* and *The Ladder* fill every round length; a 15-question
   round shows "30 — expect repeats", which is honest.
2. Each question shows one picture and the prompt **Say what you see**, and four
   options: the answer and three wrong answers drawn **from the picture's own
   subjects**. **Changed:** the options land at half the clock, not before, on
   every screen at once; until then nothing can be picked, by tap or by key.
3. **No published file gives the answer away.** No picture holds the whole
   answer as text, the prompt is not in the file's metadata, the filename is
   content-hashed and the id is a hash. `seal.test.ts` covers the new pack,
   with its pack count going from 16 to 17.
4. **Changed: Claude looks at every drawing, not Greg**, because Greg plays the
   round. The version chosen for each phrase is its `seed` in the data file,
   Vision reads every shipped drawing, and the office's *Rubbish* vote is the
   backstop. This departs from the sleeves rule that a person has to look; what
   makes it defensible is structural — **no prompt says its phrase**, which the
   tests hold, so a drawing has nothing to print but the words a puzzle asks for.
5. **No jigsaw on this pack.** Position is the clue, and a scrambled rebus is a
   different rebus. Flags opted out for the same reason.
6. **Seeded before the deploy.** `seed-vault` runs on the new ids, then
   `host-room -- 10 --pack catchphrase` plays two of them end to end with every
   reveal showing. New ids that are not seeded stall at reveal (Outstanding 10).
7. Every still carries `imageWidth` and `imageHeight` and goes through
   `compressStill`, like the other packs.
8. `public/packs/ATTRIBUTION.md` names the model and its licence, and says the
   pictures were generated.
9. No change to the rules and no paste. `typecheck`, `lint` and `test` are clean.

**Not in v1:** typed answers; *call it*; **Bonus Catchphrase**, squares lifting
off the picture, which the jigsaw's seeded order and `settledTileCount` would
make small. **Not growing past 30** until it is played: Fine Art was grown
unplayed and reverted.

## The puzzles

In `scripts/hand-catchphrase-data.ts` and nowhere else. **Twelve of the first
thirty were named in the planning conversation and swapped out**, so Greg can
play the pack blind; the trial's five are among them, which is why this file
can still name those. 8 easy, 14 medium, 8 hard, with three in 80s and 90s
titles. `hand-catchphrase-data.test.ts` holds the rules: no prompt says its
phrase, lettering is never the whole answer, every prompt leads with the house
style, and no wrong answer is another wording of the right one.

## How to build it

```bash
npm run catchphrase-draw          # ~2.8 h, three versions each, into .cache/catchphrase/
# look at every drawing; set `seed` on each spec to the version that ships
npm run write-catchphrase-pack    # refuses an unpicked spec or a drawing that prints its answer
npm run seed-vault                # before any deploy
npm run host-room -- 10 --pack catchphrase
```
