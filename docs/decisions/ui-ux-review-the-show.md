# UI/UX review — the level above the screens

> **Owner: Greg Rothwell. Last updated: 11 November 2026. Budget: 250 lines.**
> **Status: findings and options. Nothing here is chosen or built.** Session 4 of
> [`ui-ux-review.md`](ui-ux-review.md).

Greg, 11 Nov, on the first three sessions: "Was expecting more to come out of this review tbh —
maybe consider issues that are higher level than what you've currently been focusing on." He is
right: they audited screens. This asks what the hour is like, from what the office has actually
done rather than from how the screens look.

## Where the numbers come from

- **`games/`, read 11 Nov 2026 with the Admin SDK**: 92 documents, 13 test rounds dropped
  (`testRunOf`), **79 real rounds, 9 September to 11 November**, all of two seats or more.
  `.cache/ux-review/shape.ts`, kept out of git; it prints counts only.
- **`q1Traces/`, same day**: 143 traces from 25 rounds since 21 October. `.cache/ux-review/lobby.ts`.
- People are counted, never named. Blind packs appear as play counts only.
- **What this cannot see is listed at the foot.** The largest: a round is kept only when it
  finishes, so a round abandoned halfway is not in any number here.

## What the office does

| | |
|---|---|
| When | 43 playing days in nine weeks. 48 of 79 rounds finished in the 9 o'clock hour, 13 at 10, 15 in the 2 and 3 o'clock hours |
| How much | One round on 21 days, two on 13, three or more on 9 |
| Who | 28 people; 11 regulars (23–60 rounds each); 7 seen once or twice. Median 7 seats, most 11 |
| A round | 15 questions (50 of 79), 10 (18) or 20 (10). 10 seconds (39) or 15 (40). **Median 6.8 minutes** from question one to the final (66 rounds; 4.8–9.8 for the middle 80%) |
| On what | **140 of 143 traces are Windows, 3 are a Mac, none is a phone** |
| What | Random Round 18, Tunes 8, On the box 8, Catchphrase 7, General Knowledge 6, Sleeves 6: six of 25 lobby cards are 53 of 79 rounds. Eleven packs were played once or twice |

## Findings

### 1. The round is a loop, and under half of it is play

- **The answer window is a median 45% of a round's time.** A question takes 28.6 seconds of clock
  for 10 or 15 of answering.
- **A median 11.5 seconds passes between one question closing and the next opening** (899 gaps; a
  quarter over 16s, a tenth over 22s). That is the reveal, the standings and two presses by the
  quizmaster: `Standings`, then `Next question` (`QuestionScreen.tsx:150`, `Scoreboard.tsx:138`).
- **The full table is shown after every question**: fifteen times in a seven-minute round.
- Inside the window, the first answer lands at 20% of the clock, the median at 43%, the last at
  78%. **On 66% of questions every seat had answered before the buzzer, and the room then waited
  a median 2.9 seconds** for the clock.
- The beats never vary: question, reveal, table, fifteen times, then the final. Half-time exists
  (`round-end.md`) but nothing else marks where in the show you are.

*My reading.* This, more than any fade, is why it "reads as a slideshow". A television quiz shows
the board at the breaks, not after every answer. Three ways to change it, cheapest first:

| | What | Cost | Catch |
|---|---|---|---|
| a | The reveal carries your own line — "3rd · up one · +800" — and the table comes at half-time and the end, or every five | M | People like seeing the table; try it in one round first |
| b | When every seat has locked, the clock runs out in two seconds | S–M | Touches the reveal gate, which opens on `openedAt + durationSecs`; needs reading before it is promised |
| c | The show advances itself; the quizmaster keeps Start and a pause | M–L | **Reopens "auto-advance", rejected 20 Aug** ([`scope.md`](scope.md)) as serving hostless play, and after the titles lost the start to a `setTimeout`. This is narrower — a live room, a host who can hold it — but it is still Greg's to reopen |

Arithmetic, not a measurement: taking the gap from 11.5s to 6s saves 77 seconds on a
15-question round, 6.8 minutes to about 5.5.

### 2. One person runs the show, and plays it at the same time

- **One person hosted 60 of 79 rounds.** Seven others hosted the other 19.
- The host is a player too (the host won 13 of 79), so they answer, then press twice, about
  thirty presses a round, inside those 11.5 seconds.
- The lobby is their cockpit: 3,639px and 56 Tab stops at 1080p, ten groups of settings (session 3).
- **What those settings are actually set to:** the wager on 41% of rounds, a final on 37%, steals
  on 4% (3 rounds), the jigsaw on 1%, The Double on 3%, the Slop Cannon on none.

*My reading.* The product has one expert operator and the lobby is built for them. Two things
follow. For the office: a house round — the pack, then Start — with everything else behind one
"Round options" fold would cover nearly every round played. For going public (W4,
[`public-scale.md`](public-scale.md)): **the first stranger is a first-time host**, and nothing
teaches hosting. That flow has never been walked by anybody who did not build it.

### 3. The set is one show; the content is twenty

- The most-picked card is **Random Round** (18 of 79): the office chooses variety.
- What it deals — Catchphrase, a tune, a still, a price — are different television formats. They
  all play on one set: four lettered lecterns, a ladder, a blue studio.
- **The ladder says nothing true about the score.** It shows each question's difficulty
  (`gotchas.md`); every question is worth 500 plus a rank bonus (`HANDOVER.md`). On Millionaire
  the ladder is the stakes.
- **The opening titles do not say what is about to be played.** "Tonight's field · First round
  for Ann & Ray & Host", and nothing else (session 3, screenshot and accessibility tree).

*My reading.* This is the architect's "you went with a whole Millionaire style", and it is a
bigger lever on "the TV world we envisioned" than animation. Each format wants its own card,
colour and sting, and where it matters its own layout: a Catchphrase picture should own the
screen. The lead-in (PROJ-179) is where a format's card would live, so it is the right
foundation. **A design job, not an engineering one**: it wants the design system Greg has in Claude
Design ([`office-feedback-7-oct.md`](office-feedback-7-oct.md), §5), which is still not linked.

### 4. Most of the room is not playing to win

- **One regular wins 60% of the rounds they play** (21 of 35). Of the other ten regulars, five win
  16–22% and **five win 6–12%**. An even share at seven seats is 14%.
- **43% of all points come from being fast**, not from being right (median across rounds).
- The contest is still live late: the half-time leader went on to win 52% of rounds, and **the
  last question changed the winner in 39%** — the wager and the final are doing their job.
- **Nobody is drifting off, as far as kept rounds show**: 95% of seat-questions get an answer,
  and the rate holds at 93–97% from question two to question twenty.

*My reading.* Scoring is the game's design and Greg's ("rank-based, to try", 20 Aug); no change to
it is proposed. The experience question is what the player in fifth is playing for. The pieces
exist — squads, rivals, rosettes, form — and, as far as I have read, all but squads surface at the
end, in the lobby or on the season table (*not checked screen by screen*). Put them in the round: the reveal that says "your fastest tonight" or "that's Sam beaten
three times running" is `direction-oct-2026.md`'s "make the show about the people in the room".
**Survivorship caveat:** these are the people who kept coming.

### 5. Seventy-nine seconds of lobby before a seven-minute game

- **A fresh tab waits a median 79 seconds for question one** (120 traces; a quarter wait two
  minutes, a tenth nearly three).
- In that time a player is offered the room's link (they are already in it), What's new, a squad
  picker, a sound check and the vote. Then the titles: one line and "Waiting for the quizmaster".
- **Question one is the worst question of the round**: 90% of seats answer it against 95% for
  every other. That is the known slow first write ([`cass-q1-cold-write.md`](cass-q1-cold-write.md)),
  and it is tied to this wait: 0 of 43 writes under 80 seconds in the room were slow, 10 of 60 over.

*My reading.* The wait is the cheapest stage time in the product and it is spent on admin. An
unscored warm-up question would fill it, teach lock-in (finding 6) and warm the connection that
question one keeps tripping on — three problems, one move. Survey Says already polls in the lobby.

### 6. Answering takes two presses, and one pick in nine never gets the second

- Since lock-in went live (11 rounds from 30 Oct): **110 of 981 picks were never locked** and were
  scored as on the buzzer. By round, oldest first: 21, 0, 21, 13, 15, 13, 5, 7, 1, 5, 8 percent.
- So it is learned in about five rounds — by regulars. **Every newcomer, and every public room,
  starts at one in five.**
- The only teaching is the desk line, 16px capitals: "Tap it again, or press Enter, to lock it in".

*My reading.* Greg kept lock-in for a reason ([`lock-in.md`](lock-in.md)) and the trend says the
office has it. The gap is the first round of anybody new. The warm-up question in finding 5 is
where to teach it; failing that, a first-question nudge beside the picked answer.

### 7. Built with a phone in mind; played on none

- No phone in 143 traces. The lobby still leads with a QR code "or point a phone at this", and
  session 1 of this review was done at 375px.
- So the review's ranking (laptop first, phone last) is right for the office. **It inverts the
  day a public league opens**: strangers join from phones, and the phone findings (answers under
  the desk bar, 5.9-screen lobby) become the first impression.
- What a laptop window really measures is still unknown: PROJ-180.

### 8. More is built than is played

- Eleven of the twenty packs played were played once or twice in nine weeks; four options are on
  in under 5% of rounds (finding 2). The gallery holds 97 frames; `docs/decisions/` 109 files.
- Each is a control in the lobby and a state on the question screen that has to stay right.

*My reading.* Not an argument to delete what the office enjoyed twice. It is an argument for what
the lobby leads with, and for retiring or folding what is never switched on. Steal already has a
review ticket (PROJ-118).

## What I would do, in order

1. **Finish PROJ-178 and PROJ-179** (the question screen, then the lead-in). Already agreed.
2. **Name the show**: the titles and the lead-in say which format is on, with its own card. S–M
   for the card; the per-format look is a design pass.
3. **Cut the gap** with option (a): your line on the reveal, the table at the breaks. M. Try it in
   one round and read `games/` for the gap.
4. **A house round in the lobby**: pack, Start, options folded. M.
5. **A warm-up question** in the lobby wait, teaching lock-in. M.
6. **People in the round**: rival and personal-best lines on the reveal. M, after 3.

## What this cannot see

- **Abandoned rounds.** A record is written at `finished`. How many rounds start and stop is not
  known, so drop-out mid-round is invisible here.
- Pacing needs each answer's server `at` stamp: 66 of 79 rounds have it. The gap includes the
  vault round trip and, since 23 Oct, up to 3s waiting for a slow write.
- "Locked" before 30 Oct means "answered"; lock-in did not exist.
- Ties count as a win for each. The 79 rounds may include a few of Greg's own trial rooms that
  were not named as tests.
- Traces cover 25 rounds from 21 Oct, not the nine weeks.
- **Nobody was asked anything.** No player was interviewed, and the architect's view is two
  sentences relayed by Greg. Whether people are on a call or in one room while they play is not known.

## Open questions — all Greg's

1. The table after every question, or at the breaks (option a)?
2. Reopen advancing on a timer inside a live round, host keeps Start and pause (option c)?
3. Per-format identity: worth a design pass, and is the Claude Design system the place for it?
4. A house round with the options folded?
5. A warm-up question in the lobby?
6. Is one person winning 60% a problem, or the point?
7. Fold or retire steals, the jigsaw and the Slop Cannon?
8. Are players together — a call, a room — while they play? It changes what "social" should mean.
