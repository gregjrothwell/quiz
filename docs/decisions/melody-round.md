# The melody round, as played

> **Owner: Greg Rothwell. Last updated: 9 September 2026. Budget: 250 lines.**

Built 4 September ([`round-types.md`](round-types.md#music-round)), played for
the first time on **8 September 2026**, and it did not work. This is the
feedback and the measurements behind it. Logged first, on Greg's instruction;
**the cheapest fix — hearing it again — is live since 8 September 19:48
(`index-BDZpMBAG`), unplayed**, see the end. The pool and the distractors are
still as they were.

## What happened

> "Just played a music round and it was terrible. Music clips were way too short
> and nobody knew any." — Greg, 8 September 2026

Read off the live project rather than off the complaint, which turned out to
matter — the room says something the complaint did not.

| | `DTK8` — the melody round | `3QDV` — the Science round, same day |
|---|---|---|
| Players | 8 | 8 |
| Questions set | 15 | 15 |
| Questions reached | **4** | 15 |
| Phase now | `reveal`, abandoned | `finished` |
| Window | 15s | 15s |
| Top score | 1,900 | 7,999 |
| Bottom | **two players on 0** | 2,400 |

**Eight people abandoned a fifteen-question round after four and went and
played Science instead.** That is the strongest thing in this file and it is
not something anybody said out loud.

## "Nobody knew any" is very nearly literal

Four questions across eight players is 32 chances to answer. The room scored
**8,800 points** in total. A correct answer is worth between 600 and 1,000
(500 flat plus a rank bonus of 500/400/300/200/100 —
[`scoring.md`](scoring.md)), so 8,800 points is **between 9 and 15 correct
answers out of 32**.

That is **28%–46% against the 25% you get by guessing.** Two of the eight
scored nothing at all. The Science round the same night, same eight people, ran
to 7,999.

The four tunes actually served, with their options:

| # | Options |
|---|---|
| 0 | The Pearl Fishers / British Airways / **Flower Duet** / Lakmé |
| 1 | An American in Paris / Rhapsody on a Theme of Paganini / Rhapsody in Blue / Summertime |
| 2 | Jerusalem / Rule, Britannia! / Nimrod / Pomp and Circumstance |
| 3 | Jesu, Joy of Man's Desiring / Toccata and Fugue in D minor / Brandenburg Concerto No. 3 / Air on the G String |

**Question 3 is four Bach pieces.** Question 1 is three Gershwin and a
Rachmaninoff. Recognising the composer is not enough — you have to tell four
works by the same composer apart, from a triangle wave. That is a harder
question than anybody intended to write, and it is a *second* problem the
complaint did not name: **the distractors are drawn from the same pool as the
answer**, so the pool being narrow makes every question harder rather than
easier.

## "Way too short" is measured, and it is worse than it sounds

Across all 70 tunes in `public/packs/melody.json`, taking each clip's length as
the last note's `start + duration`:

| | seconds |
|---|---|
| shortest | **1.92** (8 notes) |
| 25th percentile | 2.89 |
| median | **3.45** |
| 75th percentile | 4.20 |
| longest | 5.22 |

**20 of 70 are under three seconds. 48 of 70 are under four.**

Against the 15-second window that round was played on, the median tune uses
**23% of the question** and the room sits in silence for the other 11.5
seconds — because two things compound:

1. **It plays once and never again.** `startedClockRef` in
   [`QuestionScreen.tsx:247`](../../src/screens/QuestionScreen.tsx#L247) is
   keyed on `gameId:index` and guards the effect specifically so a re-render
   cannot stack a second copy. Correct for its purpose, and it also means there
   is no replay — miss the opening bar and the question is over for you.
2. **There is no clock bed underneath it.** `playSequence` calls `stopClock()`
   ([`sound.ts:396`](../../src/lib/sound.ts#L396)) so the nine-second backing
   does not fight the tune. On a melody question the room therefore gets ~3.5
   seconds of triangle wave and then **actual silence** — quieter than any
   other round type, at the moment when nobody knows the answer.

Anyone whose audio had not unlocked, or who joined mid-question, heard nothing
at all and had no way to ask for it again.

## What is not known yet

- **The picture round has never been played with people.** `NDH7` on 4
  September is one player, unfinished — a solo test. Nothing here transfers to
  it: it has no clip length, no replay problem and no audio unlock.
- **Whether the pool or the presentation is the bigger half.** Both are real;
  which one to spend on is a judgement, not a measurement. Copyright is what
  makes the pool classical — `TUNE_RIGHTS_YEAR`, composers dead before 1956 —
  so widening it towards music this office would recognise is the one
  constraint here that is not ours to move
  ([`round-types.md`](round-types.md#the-licensing-cdpa-checked-4-september-2026)).

## Options, none chosen

Listed so the next session starts from a list rather than from the complaint.
Cheapest first; none of these has been costed against the database, and none of
them needs to be — a melody is bytes in a pack, like every other round type.

1. **Loop the clip, or replay it on a tap.** Smallest change, aims at the dead
   air rather than the pool. A replay button is the honest version: it costs
   nothing and it fixes the missed-opening-bar case as well.
2. **Lengthen the clips.** Content work, tune by tune. The median is 13 notes;
   doubling that is 70 hand-edits.
3. **Draw distractors from other composers**, so a question tests "whose is
   this" before "which of theirs is this". Pure selection, no new content.
4. **Accept that the pool is not office quiz material** and make the melody
   round an occasional novelty rather than one of the three default rounds.

## The handover was wrong about this being unplayed

`HANDOVER.md` said the melody and picture packs were on branch `melody-round`
and "not live" as of 4 September. Both were merged the same day (PR #23) and
deployed: the live bundle is `index-CIOq186A.js`, not the `index-BOq4sYDx` the
handover named, and `packs/melody.json` and `packs/picture.json` both return
200 from GitHub Pages. Corrected there on 8 September.

Same failure as the one already written up in
[`round-types.md`](round-types.md#the-prose-was-wrong-and-that-is-a-finding) —
the prose said unplayed, the live project said otherwise, and one query settled
it. That is twice now.

## Built 8 September 2026 — hear it again, for everybody

Option 1 above, shipped to every player rather than to half of them.
`QuestionScreen` offers **Hear it again** under the prompt of a melody question
while the clock runs (`R` on the keyboard), disabled with the lecterns at the
buzzer and gone at the reveal. `playSequence` already stops whatever is
playing before it starts, so a second press restarts the tune rather than
stacking it; the once-only guard on the automatic play is untouched. A muted
player is unmuted by the press and hears it — the button that does nothing was
the alternative — and the press is the user gesture a suspended audio context
was waiting for, which closes the "arrived with audio locked, heard nothing,
no way to ask" case as well as the missed opening bar.

**Why not the A/B the research proposed.**
[`what-to-build-next.md`](what-to-build-next.md) suggested randomising the
replay within the round by `hash(gameId, question.id)` so every player met both
arms. The instrument is right and the target is wrong: eleven seconds of
silence on a fifteen-second question is a defect, and a round where half the
questions offer the button and half do not looks broken to the room that has
already walked out of it once. The replay ships whole. The before is `DTK8` —
4 questions, 28–46% against 25% for guessing — and the after is whatever
`npm run read-games` says about the next melody round, now that
[`game-record.md`](game-record.md) keeps one. Save the within-round A/B for a
variant players cannot see: cross-composer distractors, which is option 3 and
is pack regeneration, not a screen change.

**Evidence.** Server-rendered against the gallery fixture
(`Question · melody, hear it again`) and read off the markup: the button is
present and enabled with the clock running, present and `disabled` at expiry,
absent at the reveal and absent on a text question; the legend shows `R` in
the first two states only. **Not yet done in a browser**: the press itself, and
the label reading *Hear it again* rather than *Unmute and hear it again* — the
server snapshot of the mute store is always muted, so the markup shows the
muted label; the unmuted one is the same expression with the other branch.
Typecheck, lint and 726 tests clean.

**Still open, and not chosen**: the pool (copyright is why it is classical),
the distractors (four Bach pieces), the clip length (70 hand-edits), and
whether the clock bed should come back under the silence after the tune ends —
a sequence-end callback in `sound.ts`, not done here.

## 9 September 2026 — Name that Tune is now iTunes, Classical keeps the synth

The office walked out of a classical triangle-wave round. The fix that is not
a longer synth clip is Apple's 30s preview, streamed from
`audio-ssl.itunes.apple.com`, never put in the repo. Search/lookup is pack-build
only (~20/min, cached). Play time is `<audio src=previewUrl>`. A store URL with
the SEO slug stripped sits next to a "Listen on Apple Music" lockup — Apple's
"proximate to a store badge" rule, and the only clean hook; UK fair dealing
does not cover a public Pages quiz.

`tunes` stole the lobby name. `melody` is **Classical**. Mute gate covers both.
Hear it again / `R` still works. 79 GB-store tracks, distractors from other
artists. Vault seeded 9 September (206 added). Live the same day as
`index-6odlsKCm`. `itunes-probe` is live and out of `npm test`.
