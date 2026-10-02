# Catchphrase — say what you see

> **Owner: Greg Rothwell. Last updated: 2 October 2026. Budget: 250 lines.**

A picture round where each question is a cartoon of a well-known saying or
title, Roy Walker style. **Nothing is built.** This file holds the plan, the
trial that settled where the pictures come from, and the story waiting on
Greg's approval.

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
   PNG. Without the flag, mflux's help says it embeds generation metadata
   ("EXIF UserComment and friends"). Whether `compressStill`'s `sips` pass
   would strip that is **untested**, so the flag is the rule.

### The old programme's look — compared 2 October 2026

The same three scenes were redrawn with a 1980s computer-graphics prefix (flat
colours, thick outlines, no shading, dark background) so Greg can choose by
eye. Elephant 3 of 3; nail 3 of 3, though the man always holds the hammer
himself; cats and dogs 2 of 3, the third too sparse. Vision read nothing on any
of the nine, and the speed was the same, 338–346 s a phrase. It comes out as a
flat cel cartoon. **Whether that is the programme's look is Greg's call, not a
claim made here.** The style is one line of the prompt, so either choice costs
the same.

## What the old programme was

From [UKGameshows](https://www.ukgameshows.com/ukgs/Catchphrase), read 2
October 2026: ITV from January 1986 with Roy Walker, made by TVS with Action
Time. Contestants buzzed in on computer-animated puzzles showing phrases,
sayings and titles. **Bonus Catchphrase** hid a picture under nine squares
removed at random. **Super Catchphrase** was a 5×5 grid. Many animations
starred a robot, Mr Chips. The one example the page names is *dishing the
dirt*. The 2013 revival moved to 3D CGI and mostly celebrity contestants.

**Taken from it:** everyday British sayings plus 80s and 90s titles, drawn
literally, sometimes a picture with a word or a number. **Not taken:** the
programme's pictures, Mr Chips, or its music.

## The story — awaiting Greg's approval

> As the quizmaster, I want a Catchphrase round of cartoon pictures of
> well-known sayings and titles, so that the office gets a picture round that is
> a puzzle rather than a memory test.

**Acceptance criteria**

1. The lobby offers a pack titled **Catchphrase**, blurb *Say what you see*:
   hand-built, **30 puzzles**, 8 easy, 14 medium and 8 hard. *As it comes* and
   *The Ladder* fill every round length. A 15-question round shows "30 —
   expect repeats", which is honest.
2. Each question shows one picture, the prompt **Say what you see**, and four
   options: the answer and three wrong answers drawn **from the picture's own
   subjects** (cats, dogs and rain; never four unrelated sayings).
3. **No published file gives the answer away.** No picture holds the whole
   answer as text, the prompt is not in the file's metadata, the filename is
   content-hashed and the id is a hash. `seal.test.ts` covers the new pack,
   with its pack count going from 16 to 17.
4. **Greg has looked at every picture** on a contact sheet before it ships, and
   the version chosen for each phrase is recorded in the pack's data file.
5. **No jigsaw on this pack.** Position is the clue, and a scrambled rebus is a
   different rebus. Flags opted out for the same reason.
6. **Seeded before the deploy.** `seed-vault` runs on the new ids. `host-room`
   gains `--pack catchphrase` (today it takes only `sleeves`,
   `scripts/host-room.ts:130`) and plays published Catchphrase ids end to end,
   every reveal showing. New ids that are not seeded stall at reveal
   (Outstanding 10).
7. Every still carries `imageWidth` and `imageHeight` and goes through
   `compressStill`, like the other packs.
8. `public/packs/ATTRIBUTION.md` names the model and its licence, and says the
   pictures were generated.
9. No change to the rules and no paste. `typecheck`, `lint` and `test` are clean.

**Not in v1:** typed answers. **Bonus Catchphrase**, where squares lift off the
picture on the shared clock, is the lever if the round plays too easy. The
jigsaw's seeded order and `settledTileCount` (`src/engine/jigsaw.ts`) make it
small, but it waits until one round has been played. **Not growing past 30**
until it is played: Fine Art was grown unplayed and reverted.

## Open decisions — Greg

1. **The 30 phrases and their wrong answers** in the table below.
2. **The look:** clay 3D, as trialled, or the 1980s comparison.
3. **The title:** *Catchphrase*, in line with *Name that Tune*.

## The 30 — for approval

Pictures describe the scene for the prompt; they are not shown to players as
text. Wrong answers are in no order, since the game sorts options.

| # | Answer | Level | Picture | Wrong answers |
|---|---|---|---|---|
| 1 | Raining cats and dogs | easy | Cats and dogs tumbling out of a storm cloud | Fighting like cat and dog · It never rains but it pours · Every cloud has a silver lining |
| 2 | The elephant in the room | easy | An elephant squeezed into a living room; the couple on the sofa ignore it | An elephant never forgets · A white elephant · No room to swing a cat |
| 3 | A bull in a china shop | easy | A bull among shelves of plates and teacups, smashing them | Take the bull by the horns · Like a red rag to a bull · Not my cup of tea |
| 4 | Egg on your face | easy | A man with a fried egg splattered across his face | Walking on eggshells · Face the music · A good egg |
| 5 | Pigs might fly | easy | Pigs with wings flying past an aeroplane window | Bring home the bacon · Make a pig's ear of it · Time flies |
| 6 | Couch potato | easy | A potato lounging on a sofa holding the TV remote | Hot potato · Small potatoes · Meat and two veg |
| 7 | A fish out of water | easy | A goldfish flopping on a dry office desk beside an empty bowl | Plenty more fish in the sea · Something fishy · Like water off a duck's back |
| 8 | Hit the nail on the head | easy | A hammer striking a nail on a bald man's head | Hard as nails · Head over heels · Hammer and tongs |
| 9 | Butterflies in your stomach | medium | A nervous man at a microphone, butterflies inside his see-through tummy | Social butterfly · Gut feeling · Nervous wreck |
| 10 | Once in a blue moon | medium | The word ONCE across a glowing blue moon | Over the moon · Out of the blue · Once bitten, twice shy |
| 11 | A storm in a teacup | medium | A tiny thundercloud flashing lightning inside a teacup | Not my cup of tea · The calm before the storm · Take the world by storm |
| 12 | Spill the beans | medium | A tin of baked beans knocked over, beans sliding across a table | Full of beans · Cry over spilt milk · Not worth a bean |
| 13 | Dishing the dirt | medium | A waiter presenting a silver platter piled with soil | Dirt cheap · Down to earth · Spill the beans |
| 14 | Under the weather | medium | A man in bed beneath his own little raincloud | Right as rain · Weather the storm · Steal someone's thunder |
| 15 | On cloud nine | medium | A grinning woman sitting on a fluffy cloud with a big 9 on its side | Head in the clouds · Dressed to the nines · Every cloud has a silver lining |
| 16 | Bite the bullet | medium | A man clenching a huge brass bullet between his teeth | Dodge a bullet · A silver bullet · Sweating bullets |
| 17 | Barking up the wrong tree | medium | A dog barking at an empty tree while a cat sits in the tree beside it | Let sleeping dogs lie · His bark is worse than his bite · Can't see the wood for the trees |
| 18 | Pulling your leg | medium | One man tugging another man's leg while he hops | Break a leg · Cost an arm and a leg · Shake a leg |
| 19 | In the same boat | medium | Two grumpy neighbours squeezed into one tiny rowing boat | Rock the boat · Miss the boat · Push the boat out |
| 20 | Walking on eggshells | medium | A man tiptoeing across a floor covered in broken eggshells | Walking on air · Don't put all your eggs in one basket · Egg on your face |
| 21 | A frog in your throat | medium | A singer with a frog visible in his see-through throat | A lump in your throat · Jump down someone's throat · Toad in the hole |
| 22 | The big cheese | medium | A huge wedge of cheese in a tie at the head of a boardroom table | Say cheese · Cheesed off · A big fish in a small pond |
| 23 | Back to square one | hard | A board-game counter walking backwards onto a square marked 1 | Back to the drawing board · Fair and square · A square meal |
| 24 | Face the music | hard | A man nose-to-nose with a giant musical note, staring it down | Music to my ears · Save face · Change your tune |
| 25 | The apple of my eye | hard | A close-up eye whose pupil is a shiny red apple | The Big Apple · An apple a day keeps the doctor away · The eye of the storm |
| 26 | Over the top | hard | A man vaulting over a giant spinning top, the toy | Top of the morning · Over the moon · Top dog |
| 27 | Tongue in cheek | hard | A face with the tongue bulging out through one cheek | Cat got your tongue · Turn the other cheek · Bite your tongue |
| 28 | Blackadder | hard | A black snake at a desk doing sums on a calculator | Black Beauty · Red Dwarf · Countdown |
| 29 | Dirty Dancing | hard | A couple ballroom dancing, both caked head to toe in mud | Strictly Ballroom · Dirty Harry · Footloose |
| 30 | Fawlty Towers | hard | Two tall towers with big cracks and crumbling bricks | The Towering Inferno · Crackerjack · The Two Towers |

**Titles (28–30)** are all-title option sets, so a player is never choosing
between a saying and a programme. The prompt stays *Say what you see*; the
options say which kind it is.
