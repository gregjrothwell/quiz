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

**This is structural, not bad luck.** Apple picks a track's 30 seconds to be its
most recognisable stretch; for a lot of pop that is the chorus, and the chorus is
where the title is sung. *The clip that is easiest to place is the one that
answers itself.*

`previewSeconds` caps a clip from `previewStart`. **Trimming rather than
shifting, and that ordering is deliberate:** Apple's opening is the recognisable
half, and losing it is the exact failure this round already had once, when eight
people walked out of a melody round nobody could place. Shifting is the fallback
for a title sung too early to leave a clip worth playing, and a trim has to
leave eight seconds — over half the question — or it shifts instead.
`chooseClip` returns `unavoidable` rather than shipping a six-second question.

The cut watches `currentTime`, not a timer. A timer measures from the `play()`
call and the clip does not start there — it starts when Apple's CDN has
delivered it, so on a slow connection a timed cut lands early, or mid-word.

### The audit, and why it is a transcriber and not an ear

`npm run tune-audit` downloads every preview, transcribes it and prints the
`previewStart` / `previewSeconds` to paste in. Local-only and out of `npm test`
like `itunes-probe`; the matching is pure and tested.

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
"hey Jude" re-consonants both words and is missed; the threshold that would
catch it convicts clean clips. The answer is a bigger model, not a looser
matcher — and "very obviously" and "transcribed correctly" turn out to be close
to the same set.

### What it found, over all 177

On the widest window a quizmaster can pick:

| verdict | count | what happens |
|---|---|---|
| clean | 103 | nothing changes |
| trimmed | 33 | plays from 0, stops before the title |
| shifted | 31 | starts after the title |
| **unavoidable** | **10** | left alone — no 8-second window avoids it |

**Hotel California is the one that already had a hand-set `previewStart: 8`,
and it was making the question worse.** Apple's preview of that track is the
chorus, so skipping eight seconds landed the player squarely on "Welcome to the
Hotel California" at 9.2s. It now plays 0 → 8.6s: the guitar figure and the
words "Welcome to the". The audit did not just fill in blanks; it corrected a
guess.

**The ten that cannot be fixed**, because the title *is* the hook and it is
sung from the top: `relax`, `purple-rain`, `i-will-always-love-you`,
`country-house`, `love-will-tear-us-apart`, `mad-world`, `highway-to-hell`,
`never-gonna-give-you-up`, `hey-ya`, `as-it-was`. Greg's "wherever possible"
is the licence to leave these; the alternative is retiring ten good songs.
`mad-world` is the one with a number against it — 11 of 11, 3.9s, on `hard`.

**The cut, proved against Apple's CDN in a browser.** A cut at 8.6s stops the
element at 8.71s; a cut at 24.4s stops it at 24.6s. `timeupdate` fired every
0.267s at worst, so `LEAD` at 0.6s is about 2.2× the slop and the word never
plays. It was 0.4s, which worked and left 0.16s — luck, not margin.

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
alongside every hit. Same correction on `sweet-dreams`: 91% in the live round
looked like a giveaway, and the preview turns out to be the verse. That 91% is
the riff being unmistakable, which is a good question, not a broken one.

### The two things the checker got wrong, and how they were caught

**Parklife was called clean because the word boundaries disagreed.** Whisper
heard the shouted title as "pork life" — one word split into two, so a one-word
window could only ever see "pork" or "life". It is the fastest median in the
round it was played in (3.0s). Windows one either side of the title's length
catch it at 1.00, and the false positives that came with the wider net all
turned out to share one shape — off-length windows — so those clear 0.07 more.
All three go, every true match stays.

**Seventeen clips transcribed to nothing, and eleven of them were not silent.**
`no_speech_threshold` had decided the window was not speech and thrown the
decode away. Forced:

| | first pass | forced |
|---|---|---|
| `shake-it-off` | *(nothing)* | "I'm just gonna shake shake shake shake shake / Shake it off, shake it off" |
| `crazy-in-love` | *(nothing)* | "Got me looking so crazy right now" |
| `rehab` | *(nothing)* | "I don't ever wanna drink again" |

**A clip that sings its own title six times in ten seconds was counted clean.**
All seventeen are the right studio recording by the right artist — checked
against the iTunes lookup, so this was the transcriber and not the pack.

Forcing every clip would be worse, and the same run proves it: Blue Monday's
synth section comes back as "I'm going to go ahead and put this on the back",
and September as "hey" 112 times. The second pass therefore runs only where the
first found nothing, and is kept only where it found words. It is safe *there*
because of what is being looked for — the matcher wants one specific phrase,
and invented filler is not that phrase. **A hallucination costs a needless
trim; a suppressed decode ships a clip that reads the answer out.** The
asymmetry is what settles it, not the transcript being trustworthy.

Seven are still empty with the detector off — `summer-of-69`, `le-freak`,
`sweet-home-alabama`, `wish-you-were-here`, `the-final-countdown`, `mmmbop`,
`wake-me-up`. They are counted clean and **the audit names them**, because
"nothing was heard" and "nothing is there" look identical in a tally. Seven
clips is a job for an ear; 177 is not.
