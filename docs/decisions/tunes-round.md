# Name that Tune, as played

> **Owner: Greg Rothwell. Last updated: 10 September 2026. Budget: 250 lines.**

Split out of [`melody-round.md`](melody-round.md) on 10 September 2026, at 323
lines against a 250 budget. **Moved verbatim; only where it lives has changed.**
They are two rounds now: `melody` is Classical and synthesised, `tunes` is
Apple's previews, and the file that ends "the office walked out of a classical
triangle-wave round" is the wrong place to keep what happened next.

Read [`melody-round.md`](melody-round.md) first: the 8 September failure is why
this round exists at all.

## 9 September 2026 — Name that Tune is now iTunes, Classical keeps the synth

The office walked out of a classical triangle-wave round. The fix that is not
a longer synth clip is Apple's 30s preview, streamed from
`audio-ssl.itunes.apple.com`, never put in the repo. Search/lookup is pack-build
only (~20/min, cached). Play time is `<audio src=previewUrl>`. A store URL with
the SEO slug stripped sits next to a "Listen on Apple Music" lockup — Apple's
"proximate to a store badge" rule, and the only clean hook; UK fair dealing
does not cover a public Pages quiz. **"The only clean hook" is wrong, and the
badge moved to the reveal on 22 September 2026 — the terms read against the
actual text, and Greg's decision, are in
[`known-limits.md`](known-limits.md).**

`tunes` stole the lobby name. `melody` is **Classical**. Mute gate covers both.
Hear it again / `R` still works. 79 GB-store tracks, distractors from other
artists. Vault seeded 9 September (206 added). Live the same day as
`index-6odlsKCm`. `itunes-probe` is live and out of `npm test`.

## 10 September 2026 — played again, and the notes are volume and giveaways

> "We just played a music round and it was much better this time." — Greg,
> 10 September 2026

The iTunes round works. Three things came out of it, in his order of priority.

### The scoreboard says so too, and it names the giveaways

`CX5E`, 08:46, **is the first round the game has ever kept** — `games/` went
live on 9 September and nothing reached `finished` on it until this one
([`game-record.md`](game-record.md)).

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
`MASTER_GAIN = 0.22`, and nobody has complained about a buzzer in weeks of
rounds. The number nobody had set was the `<audio>` element's, which defaults to
**1.0**, and a commercial master at full scale is as loud as the machine goes.
`playPreview` cannot route through the AudioContext — Apple's CDN sends no CORS
header — so the master gain never reached it, and that is why the two are
calibrated separately.

`DEFAULT_VOLUME` is **0.35**, about −9 dB, which is where a music bed sits under
speech. `masterGainFor(level)` divides by that default rather than scaling
`MASTER_GAIN`, so **the slider's starting position is a no-op for the cues** — a
round that is not a music round sounds exactly as it did. Capped there as well:
above the default the slider lifts only the music, because the loudest cue voice
is 1.1 relative and several ring at once, so the 0.63 master an uncapped 1.0
would give sums past unity and clips hard at the destination.

### 2. The slider is in the corner, not the lobby

> "Include a volume slider below the mute button so people can adjust it
> themselves easily."

Under `SoundToggle`, right-aligned to it, so the switch has not moved by a pixel
— measured at x1220/y24, 36×36, the same rect as before. The corner is the only
furniture on **every** screen of a round, and the moment somebody wants the
volume is mid-clip, while the music is over the person talking; a control in the
lobby would be no use to them. Left live while muted on purpose, because setting
the level before turning the sound back on is the sensible order.

**Evidence, in a browser against the built bundle** (`vite preview`, 5274):
clicking the right end of the track reads back `100` and stores `1`; the left
end reads `0` and stores `0`; a reload comes back at the stored level.
A real Apple preview element is created at `0.35`, and dragging the slider to
`0.15` **while it is playing** moves the running element to `0.15` — which is
the case Greg described. 44px hit area, right edge flush with the switch,
checked at 1280 and at 375.

**One instrument lied on the way.** The dev server on 5273 had been up since the
previous evening and served the *previous* code — no `.sound-rig` in the DOM at
all, through two reloads, same directory and same branch; the watcher had
stopped seeing changes across a sleep. Every reading taken against it described
code that was not running. Building and serving `dist/` fixed it; the tell was
`hasRig: false` on markup that could not possibly be missing it.

### 3. Clips that say their own name

> "A few of the clips also had the title of the song in them very obviously.
> This should be avoided wherever possible."

**Moved to [`tunes-title-gate.md`](tunes-title-gate.md) on 22 September 2026**,
verbatim, when this file went over budget. The transcriber, what it found over
all 177, how the checker was checked, and the two things it got wrong are all
there.
