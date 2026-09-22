# Clips that say their own name

> **Owner: Greg Rothwell. Last updated: 22 September 2026. Budget: 250 lines.**

Split out of [`tunes-round.md`](tunes-round.md) on 22 September 2026, at 253
lines against a 250 budget. **Moved verbatim; only where it lives has changed**
— the heading below still reads "3." because it was the third of Greg's three
notes from 10 September, and renumbering it here would be the rewrite the
memory protocol forbids.

The sister file is [`sleeves-gate.md`](sleeves-gate.md): the same problem on
album covers, solved by reading the artwork instead of the audio.

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
