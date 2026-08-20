# The clock

> **Owner: Greg Rothwell. Last updated: 20 August 2026. Budget: 250 lines.**

Moved verbatim out of `docs/HANDOVER.md` on 20 August 2026, when that file reached
2,422 lines. The text is unchanged; only where it lives is.

## The clock

The last nine seconds of every question carry a gameshow clock: a walking bass
in A minor over a swung ride cymbal, brass marking every third second, and a
gong on zero. It replaces the two-tone tick, which told you time was passing
but never that it was running out. `tick` and `tock` are gone from the `Cue`
union entirely.

**Composed backwards from the buzzer.** `CLOCK` in `src/lib/sound.ts` is indexed
by *seconds remaining*, not seconds elapsed. That is the whole design and the
reason it survives a configurable answer window: 10, 15 and 20 all land the
identical closing cadence and differ only in how much walk they get in front,
and a window shorter than the lead — the rules allow five — starts further down
the table and still finishes on the same note. Nothing is stretched to fit, so
there is no duration that sounds wrong.

**Scheduled in one call, against the audio clock.** `startClock(remainingMs)`
schedules every oscillator to the buzzer in a single pass. The old tick fired
from a React effect on `secondsLeft`, which rides the 100ms interval in
`useQuestionClock` — so each tick landed up to a tenth of a second late. Nobody
can hear that on a lone beep and everybody can hear it on a pulse. Offsets are
computed from the real `remainingMs` rather than from whenever the call
happened, so the music stays locked to the timer face no matter what the render
loop is doing.

The cost is that it commits to an ending, so **anything that ends the question
early has to come and cancel it**: `stopClock` is called on reveal, on unmount,
and by `setMuted`. Muting cannot wait for the next note not to play, because the
next note is already scheduled.

**The gong is a cue, not part of the bed.** It fires on the reveal that already
existed (`useCue('gong', ...)`), which is deliberate: scheduled as the bed's
last cell it would sit exactly where `stopClock` runs, and the auto-reveal on
expiry would cancel it before it sounded. It replaces the old `hush` cue
outright. Its partials sit at deliberately non-whole-number ratios because a
struck plate does not vibrate in octaves — **there is a test guarding that**,
since tidying them into neat multiples would silently turn the gong back into a
bass note with nothing to show it had happened.

It is tuned to A, so it resolves the iv–V–i the walk has been climbing. The bed
ends on a leading tone that never resolves; the gong is the chord it wanted.

### Why it is not the Countdown music

Because that is a specific Alan Hawkshaw composition, copyright Channel 4, and
one of the most lucrative commissions in British television precisely because it
earns a royalty every time the clock runs. There is no open-source version and
there will not be one; every free download of it is an unlicensed rip, and a
re-recording is a derivative of the composition and needs the same licence.

What is protected is the **melody**. What is not protectable — and what does
most of the work of sounding like teatime television — is the furniture: the
walking bass, the swing, the section voicings, the chromatic approach into the
V, the gong. Those are ideas, and the harmony is a turnaround that sits under
half the standards written before 1960. All of it is used here deliberately and
none of it is anybody's property.

**Do not "improve" this by moving the melody closer to theirs.** Musical
infringement turns on whether an ordinary listener recognises the tune, so a
deliberate near-miss is the shape of case that loses — "we changed a few notes"
is the classic losing defence. Risk on that axis is not linear: it is near-zero
until it is total. Every other axis was already spent.

Freesound has genuinely CC0 clock ticks if anyone reaches for samples, but they
buy nothing this does not already synthesise, and they would put an asset on the
critical path of a round for the first time. The one genuinely public-domain
British option is the Westminster Quarters (1793, Big Ben) — it was built and
rendered, it counts down naturally in quarters to the hour bell, and it was
passed over rather than rejected. Parliament's *recordings* carry their own
copyright; the tune does not, and this project synthesises.

### What has and hasn't been checked

Verified: the arithmetic (six tests, including that every answer length lands
the same cadence and that a 3.4s window truncates correctly), the gong's
inharmonicity, and the real Web Audio path driven headless in the browser —
no errors, restart-while-running and double-stop both safe, 65 oscillators for a
full bed.

**Heard, and it works.** Confirmed by ear on 14 August 2026, which closes the
one gap none of the above could: the bed and the gong sound right, and the
balance set by eye on a waveform — 0.194 against 0.323 at peak — turned out to
be right by ear too. That was the likeliest thing to need tuning and it did not.

Two things the ear test did not settle, because neither shows up on one device:
whether several laptops in a room phase audibly against each other (see [known
limits](state-of-play.md#known-limits)), and how it holds up over fifteen questions rather than
one. Round fatigue is the reason the bed is nine seconds and not the whole
window, but nobody has yet sat through a full round of it.

---

## The clock, and what it actually costs

This is the 17 August report, in the player's own words:

> it was just those two moments where my timer was stuck on 0 after the question
> was over and the other being it said I had 5 seconds left but it instantly went
> to 0 and I couldn't answer

Two different halves of one thing: **every device runs its own private clock, and
nothing on screen ever admits it.**

`useQuestionClock` counts from the moment *this* device saw the question open.
That is deliberate and the reasoning is sound — syncing to `questionOpenedAt`
would fold the quizmaster's clock offset into everybody's speed score, and office
laptops disagree by more than the bonus is worth. What was not thought through is
what the gap does to a player.

**"Five seconds left, then instantly zero, and I couldn't answer."** His snapshot
of the question opening arrived about five seconds after the room's, so his
window started five seconds late and his face was five seconds behind everyone's.
The reveal ended the question — correctly, for the room — while his timer still
showed time, and the lecterns went dead under his hand. He was not slow. He was
shown a clock the room was not running to.

**"Stuck on 0 after the question was over."** The mirror image: his clock expired
and the reveal had not reached him. Two ways in, and a player cannot tell them
apart because neither says anything. The vault gate is the interesting one — it
refuses until the *server* agrees the window has passed, and `App` retries every
1.5s up to eight times, so a room can legitimately sit at zero for twelve
seconds. **That notice only renders on the quizmaster's device.** Everybody else
gets a dead timer and no explanation.

### This was already written down, and under-rated

Under [known limits](state-of-play.md#known-limits): *"Devices in the same room will phase against
each other... If it grates in a real room, the honest fix is fewer laptops with
the volume up."*

That was filed as an audio nuisance — the nine-second bed sounding like a round
in a canon. It is the same defect, and it does not just grate. **It takes
answers off people.** The entry has been corrected.

### What would actually fix it

Not the naive shared clock the limit rules out. But `openedAt` is a
`serverTimestamp()`, not a client one, so there is a way through: each client
records `Date.now() - openedAt` when a question opens, and the **minimum** of
that across a round approximates its own pure clock skew, because delivery
latency is never negative. The rest is this device's lag, and subtracting it
gives every screen the room's remaining time rather than its own.

Real work, on the most safety-critical code in the app, and it fails quietly if
it fails — so it is a deliberate decision, not a tidy-up. Not started.

The cheap half, which is most of the harm: **let the screen say it is out of
step.** A dead zero should read "waiting for the quizmaster", and a reveal that
lands while your face still shows time should say the room has moved on rather
than silently killing the lecterns. Neither needs a shared clock, and either
would have told this player what was happening instead of leaving him to report
it a week later.

---
