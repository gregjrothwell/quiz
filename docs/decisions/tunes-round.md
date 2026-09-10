# Name that Tune, as played

> **Owner: Greg Rothwell. Last updated: 10 September 2026. Budget: 250 lines.**

Split out of [`melody-round.md`](melody-round.md) on 10 September 2026, when
that file reached 323 lines against a 250 budget. **Moved verbatim; only where
it lives has changed.** They are two rounds now, not one: `melody` is Classical
and synthesised, `tunes` is Apple's 30-second previews, and the file that ends
"the office walked out of a classical triangle-wave round" is the wrong place to
keep what happened next.

Read [`melody-round.md`](melody-round.md) first for why this round exists at all
— the 8 September failure is the whole reason.

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

## 10 September 2026 — played again, and the notes are volume and giveaways

> "We just played a music round and it was much better this time." — Greg,
> 10 September 2026

The iTunes round works. Three things came out of it, in his order of priority.

### The scoreboard says so too, and it names the giveaways

`CX5E`, 08:46, **is the first round the game has ever kept** — the `games/`
block went live on 9 September and nothing had reached `finished` on it until
this one ([`game-record.md`](game-record.md)).

| | `CX5E` — Name that Tune | `DTK8` — the melody round, 8 September |
|---|---|---|
| Seats | 11 | 8 |
| Questions reached | **10 of 10** | 4 of 15, abandoned |
| Hit rate | **65%** | 28–46%, against 25% for guessing |
| Median answer | 4.1s | — |

65% is above the Picture round's 55% and Best of British's 42% the same week.
Nobody walked out. **That is the "much better this time", measured.**

It also puts a number on the third note, which is the part nobody could have
said out loud:

```
 5  medium   91%  3.6s  Sweet Dreams (Are Made of This) — Eurythmics
 8  hard    100%  3.9s  Mad World — Tears for Fears
```

**Eleven out of eleven on a `hard` question, median 3.9 seconds.** Both sing
the title in the chorus, and Apple's preview *is* the chorus. A hard question
the whole room gets in under four seconds is not a hard question; it is a clip
reading the answer out. Read with `npm run read-games -- --game <id>`.

### 1. The default volume was covering the Teams call

> "The default volume is set too high. Meaning that you can't hear anybody on
> the teams call while the music is playing."

**The synth cues were never the loud half.** They have always been scaled by
`MASTER_GAIN = 0.22` — "quiet enough to play at a desk", and nobody has
complained about a buzzer in weeks of rounds. The number nobody had set was the
`<audio>` element's, which defaults to **1.0**, and a commercial master at full
scale is as loud as the machine goes. `playPreview` cannot route through the
AudioContext — Apple's CDN sends no CORS header — so the master gain never
reached it, and that is why the two are calibrated separately below.

`DEFAULT_VOLUME` is **0.35**, about −9 dB, which is where a music bed sits under
speech.

`masterGainFor(level)` divides by the default rather than scaling `MASTER_GAIN`,
so **the slider's starting position is a no-op for the cues** — a round that is
not a music round sounds exactly as it did. It is capped there as well: above
the default the slider lifts only the music. The loudest cue voice is 1.1
relative and several ring at once, so the 0.63 master an uncapped 1.0 would give
sums past unity and clips hard at the destination, and nobody has ever asked for
a louder buzzer.

### 2. The slider is in the corner, not the lobby

> "Include a volume slider below the mute button so people can adjust it
> themselves easily."

Under `SoundToggle`, right-aligned to it, so the switch has not moved by a pixel
— measured at x1220/y24, 36×36, the same rect as before the change. The corner
is the only furniture on **every** screen of a round, and the moment somebody
wants the volume is mid-clip, while the music is over the person talking. A
control in the lobby would be no use to them.

Left live while muted on purpose: setting the level before turning the sound
back on is the sensible order, and a disabled slider makes you unmute at
whatever the last level was to find out where it is.

**Evidence, in a browser against the built bundle** (`vite preview`, 5274):
clicking the right end of the track reads back `100` and stores `1`; the left
end reads `0` and stores `0`; a reload comes back at the stored level.
A real Apple preview element is created at `0.35`, and dragging the slider to
`0.15` **while it is playing** moves the running element to `0.15` — which is
the case Greg described. 44px hit area, right edge flush with the switch,
checked at 1280 and at 375.

**One instrument lied on the way** and is worth recording: the dev server on
5273 had been up since the previous evening and served the *previous* code — no
`.sound-rig` in the DOM at all, through two reloads. Same directory, same
branch; the watcher had stopped seeing changes across a sleep. Every reading
taken against it was of code that was not running. The fix was to build and
serve `dist/`, and the tell was `hasRig: false` on markup that could not
possibly be missing it. Second entry of this kind in `EVIDENCE.md`.

### 3. Clips that say their own name

> "A few of the clips also had the title of the song in them very obviously.
> This should be avoided wherever possible."

**This is structural, not bad luck.** Apple picks a track's 30 seconds to be its
most recognisable stretch. For a lot of pop that is the chorus, and the chorus is
where the title is sung — so *the clip that is easiest to place is the one that
answers itself*. It is not a few unlucky tracks; it is what the format does.

`previewSeconds` caps a clip from `previewStart`, and the audit below fills it
in. **Trimming rather than shifting, and that ordering is deliberate:** Apple's
opening is the recognisable half, and losing it is the exact failure this round
already had once, when eight people walked out of a melody round nobody could
place. Shifting is the fallback for a title sung too early to leave a clip worth
playing, and `chooseClip` returns `unavoidable` rather than shipping a
five-second question.

The cut watches `currentTime`, not a timer. A timer measures from the `play()`
call, and the clip does not start there — it starts when Apple's CDN has
delivered enough of it, so on a slow connection a timed cut lands early, or
mid-word, or after the clip has already finished.

### The audit, and why it is a transcriber and not an ear

`npm run tune-audit` downloads every preview, transcribes it, and prints the
`previewStart` / `previewSeconds` to paste into `hand-tunes-data.ts`. Local-only
and out of `npm test`, like `itunes-probe`; the matching is pure and tested in
`scripts/title-in-clip.test.ts`.

**A transcript of singing is not a transcript of speech**, and the failure is
pointed at exactly the wrong word: whisper mishears proper nouns hardest, and
the proper noun is usually the title. Measured, not assumed —

| model | the Sweet Caroline preview |
|---|---|
| `small.en` | "The sweet, terrible life / The times never seem so good" |
| `medium.en` | "Sweet Caroline, good times never seem so good" |

so the audit runs `medium.en`, at roughly 20 seconds a clip on CPU. MPS is not
an option: whisper's decoder wants float64 and Metal has none — it fails
outright rather than falling back.

The matcher is phonetic for the residue. Vowels are **flattened to one vowel,
not dropped**: dropping them was the first attempt and it destroys short words —
"hey" and "hate" both become "h", after which everything starting with an h
matches everything else that does. Flattened, whisper's "come on and" scores
0.70 against "Come On Eileen" and is caught, while "born" scores 0.75 against
"Torn" and is not, because a one-word title needs 0.92.

**Its limit, stated rather than papered over.** small.en's "hate you'd" for
"hey Jude" re-consonants both words and is missed, and the threshold that would
catch it convicts clean clips. The answer to that is a bigger model, not a
looser matcher — and "very obviously" in the complaint and "transcribed
correctly" turn out to be close to the same set.

### Checking the checker before believing it

Run against six clips whose answer was known first, which is what `EVIDENCE.md`
asks for after a link validator once condemned 34 good links. It found the title
in `dancing-queen` and not in `bohemian-rhapsody`, `smells-like-teen-spirit`,
`mr-brightside` or `seven-nation-army` — all correct.

It also found nothing in `africa`, `wonderwall` and `delilah`, which were on the
"title is sung" side of the list, **and the list was wrong, not the checker**:
those three previews are verse, not chorus. Apple's window is the recognisable
part, which is not always the part with the title in it. Reading the transcripts
is what settled it, and it is the reason the audit prints what it *heard*
alongside every hit.

