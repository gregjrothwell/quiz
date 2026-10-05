# Pack growth — more questions, and less time to make them

> **Owner: Greg Rothwell. Last updated: 5 October 2026. Budget: 250 lines.**

**Status: DRAFT for Greg's feedback. Nothing here is approved.** Each decision
has a `Greg:` line; write on it, and the next session builds from that.

Greg, 5 October 2026, 22:20: "draft up a plan for more questions and also for us
to look at time reduction for additional pack generation across the board."

## The problem in numbers

*Verified*: `npm run freshness`, live site, 5 October 22:14, unless marked.

| Pack | Size | Fresh rounds | Rounds in 14 days | Real rate | Runs out |
|---|---|---|---|---|---|
| **Catchphrase** | 60 | 2.3 | 2 | **2 in 4 days**: live since 2 Oct (#64) | **about 9–12 Oct** (estimate) |
| **Sleeves** | 168 | 5.0 | 5 | understated: spent from 30 Sep | about 2 weeks |
| Name that Tune | 268 | 9.5 | 5 | | about 4 weeks |
| On the box | 296 | 9.8 | 5 | | about 4 weeks |
| Everything else | | 1.6–100 | 2 in total | Fine Art, Classical, Flags: 0 | not a problem |

- **17 of the last 19 rounds came from these four hand-built packs.** The office
  does not pick the 1,500-question text packs.
- **The office uses about 130 questions a week** (about 9 rounds of 15), and
  **almost all of them come from those four packs**. That is about 30 a pack every week.
- **Recent batches** (wall clock comes from commit times and includes other work
  done alongside):

| Batch | Shipped | Took | The slow step |
|---|---|---|---|
| Sleeves 5th + 6th, 5 Oct | 64 from 450 candidates (**1 in 7**) | about 3h15m | Vision misses half the covers that print their title, so a person's look is the gate; 98 albums pinned by hand |
| Catchphrase harder, 5 Oct | 30 | about 6h | drawing: 3 versions × 110 s × 30 = **2.8 h of Mac time**, with a battery pause |
| Name that Tune 3rd, 27 Sep | 91 from 104 | not recorded | Whisper at **about 2.5 min a clip** on the CPU; 10 of 104 resolved to the wrong recording |
| On the box 3rd, 26 Sep | 109 | not recorded | **no person has looked at those 109** (handover, Outstanding 1) |

- **Going live costs 43 min to 1h46m** from word go: #65 and #66.

## Part A — more questions

### A1. First, make the requirement less dumb

**"Never a repeat" has never been checked with the office.** Within a season the
asked history never forgets, and a season only changes when someone edits
`SEASON = 'season-2'` (`src/lib/season.ts:52`). That is why every spent pack is a
crisis. A spent pack already repeats its **oldest questions first**
(`partitionByAsked`, 26 Sep), so a repeat is always the one seen longest ago.

**The lever:** let a pack forget its oldest asked ids once it has served, say,
six weeks' worth. Sleeves at 168 would then never run dry. It just recycles
questions last seen a month and a half ago. That is a small client change with no
rule paste. The rule only bounds the list at 600 ids (`firestore.rules:761`), the
list is already newest first, and `mergeAsked` already takes a `limit`
(`askedHistory.ts:61`), so a shorter cap per pack is a smaller argument. *Unmeasured:* whether anyone notices a six-week-old
repeat. The office's *Rubbish* vote would show it.

> **Decision A1.** Is a repeat acceptable after N weeks, and what is N?
> *Claude's recommendation:* yes, at six weeks, for the four hand-built packs
> only. It halves the treadmill without lowering the bar for anything recent.
>
> Greg:

### A2. Delete

- **Grow nothing nobody plays.** Fine Art, Classical and Flags have had 0 rounds
  in 14 days. That is already the rule ([[grow-what-is-played]]: Fine Art was
  grown unplayed on 26 Sep and reverted the same night).
- **Do not grow Catchphrase again before its live check.** The 30 harder puzzles
  are unplayed. If they overshoot (the target is a hit rate below 83–90%), the
  next batch should be easier, not more of the same. The office round before
  Friday is that check (go-live step 9).

### A3. What to grow, in order

1. **Sleeves, now: batch 7, 40–60 more**, on the story approved on 5 October
   ([`sleeves-growth.md`](sleeves-growth.md)). At 1 in 7 that is 280–420
   candidates. Greg's look at the contact sheet stays the gate (about 5 min).
2. **Catchphrase, straight after the live check: 30 more**, in whatever style
   the check supports. **Its runway is days, not weeks.** Friday's game alone
   could use most of it if Catchphrase is picked.
3. **On the box: first the look at the 109 stills that are already live**, then a
   batch in about two weeks.
4. **Name that Tune: a batch in about two weeks**, after B3, which makes its
   audit faster.
5. **A fifth pack the office would actually play** spreads the load.
   Blankety Blank and The Price Is Right are parked in
   [`parked-ideas.md`](parked-ideas.md). It is a bigger build, so it waits until
   the four above are safe.

> **Decision A3.** Is this the right order? Should batch sizes be one big batch
> a month per pack, or top-ups when freshness says LOW?
> *Claude's recommendation:* the order above, and **a month's worth per batch**:
> about 120 for Sleeves and Tunes, 60 for Catchphrase. Every go-live costs at
> least 43 minutes, so fewer, bigger batches are cheaper.
>
> Greg:

### A4. Catchphrase and playing blind

**Anything Claude writes, draws or picks in a session Greg reads is visible to
him**: chat, tool calls and file writes all show in the transcript. 5 October
showed that the docs can be kept clean while the chat cannot. If Greg is to play
any batch blind, the puzzles have to be written and picked **in a session he does
not open, or by a subagent whose working he never sees**. The main session sees
counts and ids only.

> **Decision A4.** Do you want to play Catchphrase blind from the next batch on?
> If so, which: a separate session you never open, or a subagent?
>
> Greg:

## Part B — less time to make a pack

The five steps, in order. **Nothing here is measured yet unless it says so.**

### B1. Delete

- **Refuse first with the cheapest check.** Sleeves loses 6 of 7 candidates. If
  the Vision title check runs before the hand-pinning and the song work, nobody
  pins an album that was going to be refused. *To check:* the order the scripts
  run in today. I have not read them for this.
- **Fewer drawings per Catchphrase puzzle.** It draws three versions of each.
  If version 1 is usually the one picked, two versions save a third of 2.8 h.
  *To measure:* each spec's picked `seed` is in `hand-catchphrase-data.ts`.
  Count which version won, in a session Greg does not read.

### B2. Simplify

- **Resolve songs by artist catalogue and album name first**, not a title search.
  The title search caused 10 wrong recordings in Tunes and 98 hand-pins in
  Sleeves. Naming the album in the term fixed 9 of the 10.
- **One sheet for everything that needs a person**: new sleeves, new stills, and
  clips that transcribed to nothing. Greg looks once, for 10 minutes, rather
  than in five scattered sittings. Today the On the box 109 have waited nine days.

### B3. Accelerate

- **Faster Whisper.** The audit runs `medium.en` on the CPU, because the PyTorch
  build cannot use Metal (`tune-title-audit.ts:24-28`), at about 2.5 min a clip.
  Builds made for Apple silicon (MLX, whisper.cpp) exist. **How much faster they are
  here is unmeasured**, so it gets measured and not assumed. **The gate:** it must
  re-derive the 177 known cuts exactly, as the CPU audit did on 27 Sep. It needs a
  download (a Python package and the model), so it needs Greg's yes.
- **Mac work runs in the background, overnight when it can.** Drawing and Whisper
  run while Claude writes the next candidate list. Check `pmset` first
  ([[mflux-drains-battery]]).
- **The two release cuts already on the table**
  ([`ci-deploy.md`](ci-deploy.md#lead-time-measured-2-october-2026--word-go-to-live-in-43-minutes)).
  Measured on #66: auto-merge would have saved 19m39s, and reusing the PR's
  tested build about 27 min.

### B4. Automate (last)

When `freshness` says LOW, a scheduled session prepares the batch as far as the
contact sheet and tells Greg. **His look stays the only manual step.** Only once
B1–B3 have been proved by hand.

> **Decision B.** Which of B1–B3 do you want, and in what order?
> *Claude's recommendation:* B3 Whisper first (the biggest single delay, and a
> clean known-good test), then the shared sheet (B2), then the cheap-check-first
> order (B1).
>
> Greg:

## Part C — tonight

Greg, 22:20: "depending on how confident you are about what you have
produced … you could regularly check my session remaining and add in some more
questions for me."

**What Claude is confident enough to do unattended:** Sleeves batch 7 on the
approved 5 October story, **stopped at the contact sheet**. The pipeline ran twice
today. Its output is candidates, not questions: nothing ships without Greg's look,
and nothing is seeded, pushed or deployed. It goes on a local branch.

**Not tonight:**
- **Catchphrase**: the transcript would show the puzzles (A4), and the direction
  is unmeasured (A2).
- **Tunes**: hours of CPU Whisper that B3 may cut.
- **Anything live.**

**Stop rules, checked between stages:**
- the 5-hour window at 80%, so the Lancashire AI session has room;
- the weekly allowance up 10 points, from 23% to 33%;
- the window resetting at 03:10;
- the battery below 30%.

Whatever is unfinished is written up as a handover.
