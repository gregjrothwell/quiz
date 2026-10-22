# Survey Says — story and acceptance criteria

> **Owner: Greg Rothwell. Last updated: 22 October 2026. Budget: 250 lines.**

**Status: BUILT, not live, 22 October 2026** (branch `survey-says`). Approved by
Greg the same day with the host-peek trade-off as drafted. Two corrections made
after approval and flagged to him: T3 (part one shows no split) and G5 (counts on
the lecterns, not bars below). **The pack is all 40 draft prompts**
([`survey-prompts-draft.md`](survey-prompts-draft.md)); Greg kept them whole the
same day. The first Wow item in
[`direction-oct-2026.md`](direction-oct-2026.md#5-wow--all-five-accepted).
Ships as an ordinary pack, the way every round type has — not behind a Lab,
which Greg shelved on 22 October 2026 as complexity we don't need.
Code claims below were read on `74fd345`, 22 October 2026.

## The idea

*Family Fortunes*, with the office as the hundred people surveyed. First the
room answers a handful of questions about itself — taps only, no right answer.
Then the same questions come back: **"We asked the office…"** — what did most
of you say?

Why it is worth building:
- **The content is the room.** No licence, no harvest, no vault seeding, and it
  can never go stale. It is the first round type that could go public (D3).
- **It is the parked Blankety Blank idea, done properly.** "Match the room" was
  left out of v1 there because the reveal and the scoring both change
  ([`blankety-blank.md`](blankety-blank.md#not-in-v1)). Here that is the whole
  point, so it is built once, for this.
- **It is about the people playing**, which is where the direction review says
  the next phase should go.

## How a round plays

1. The quizmaster picks **Survey Says** like any pack, with the usual window.
2. **Part one, "Tell us".** Each prompt shows with its four options and the
   clock. Everyone taps their own honest answer. No score, no right or wrong;
   the reveal says *"Noted — we'll come back to that"* and shows nothing else.
3. **Part two, "We asked the office".** The same prompts, in a new order. Now
   the question is *which answer was most popular here*. The top answer is
   right; speed counts as usual.
4. The podium, finals and season table work as in every other round.

## Cut to essentials

- **Four options, fixed.** Not free text: matching typed answers is a project
  of its own, and the whole engine is built on four options.
- **Hand-written prompts only**, for a British office (AGENTS.md rule). About
  40 to start, e.g. *Best biscuit with a brew: Digestive / Hobnob / Custard
  Cream / Bourbon*. A round draws 5 and plays each twice, so 10 questions.
- **No wager, steal or jigsaw** on this pack in v1. They can come later; each
  changes scoring that is already new here.
- **Not in v1:** a survey taken in the lobby beforehand, ranked points for the
  second and third answers (the real show's rule), and free-text answers.

## The story

> **As a player**, I want a round where the questions are about us — what this
> room actually thinks — **so that** the quiz is about the people in it, and
> the person who knows the office best can win, not just whoever knows the
> most trivia.

## Acceptance criteria

### Prompts

- **P1.** `public/packs/survey.json` holds the prompts: id, prompt, four options,
  and no answer field (there is none). `seal.test.ts` still passes.
- **P2.** Every prompt reads as British-office ordinary, and a test checks
  the count and that each prompt has four distinct options.

### Part one — tell us

- **T1.** A "tell us" question takes one tap per player. Changing your mind
  before the clock ends is allowed, as on any question.
- **T2.** It scores nothing for anyone, and the reveal says so rather than
  showing right or wrong.
- **T3.** The reveal shows **no split**: just that the answer was noted.
  **Corrected 22 October, after approval:** the draft showed the bars here,
  which would have handed the room part two's answers a minute before it
  asked for them. On the show the survey stays hidden until it is played.
  The bars appear once, at part two's reveal (G5), with no names.

### Part two — we asked the office

- **G1.** The correct answer is the option most of the room chose in part one.
  A tie for top makes every tied option correct.
- **G2.** Worked out by the host from part one's answers, which since W3 only
  the host can read. Every device then reads it off the room update, as a
  normal reveal does. **Where part one survives:** each player has one answer
  document, overwritten every question (`answers/{uid}`), so by part two only
  the host's game log still holds part one (`useGameLog`, session storage — it
  survives the host reloading the tab).
- **G2a.** If the chair changes hands mid-round, the new host has no part one.
  Its part-two questions are skipped with a line saying why, rather than
  guessed. (Accepted for v1; the alternative is a host-only store and a rules
  change.)
- **G3.** If fewer than 3 people answered a prompt in part one, its part-two
  question is skipped, with a line saying why. Two answers is not a survey.
- **G4.** Scoring, speed bonus, standings and the podium are unchanged.
- **G5.** The reveal shows what the room said in part one, the top answer lit.
  **Changed in the build, 22 October:** as *"2 said this"* on each lectern, not
  bars under the four. Measured at 375 px, the bars sat under the sticky desk —
  the one place on a phone nothing else goes, because it is covered — so part
  two's payoff needed a scroll to see. On the lectern it costs no height.

### Rules and records

- **R1.** **To be proved, not assumed:** a part-two reveal needs no vault and
  no new collection, because the room rule pins only which question is in
  play. If any rule change turns out to be needed, it ships with an allow case
  on the host's real write path and the matching deny cases, both run against
  the published ruleset (`check-rules`).
- **R2.** The `games/` record keeps both parts, so `read-games` can show how
  the room split.

### Proof before done

- **V1.** Unit tests: the tally, ties, the under-3 skip, and zero scores in
  part one.
- **V2.** An emulator test plays a whole Survey Says round with three players
  through the app, to the podium, and banks the season rows.
- **V3.** One real round in the office before it is called done.

## What was built, 22 October 2026

- `src/engine/survey.ts`: the deal (five told, then guessed in another order;
  options in written order so a tally means the same option), tally, ties,
  the under-3 skip, `isPickCorrect`, `guessReveal` from the host's game log.
- Reducer: a tell scores nobody and publishes no picks (`lastPicks` empty); a
  guess takes `top` and `counts`, pays every tied option, refuses a `top` or
  `counts` that doesn't fit the options.
- Awards, streaks, verdicts and the game log know a tell has no answer and a
  tied guess has several. Each device's awards ignore tells, because a member
  holds only their own tell pick and the host holds all of them.
- The host reveals survey questions with no vault. A guess with nothing to read
  is skipped, and the scoreboard says why.
- Lobby: Survey Says hides level, count, stakes and steals; Share or Shaft stays.
- Pack: `scripts/survey-prompts.ts` → `npm run write-survey-pack`.

**Evidence:** 22 engine cases (tally, ties, skip, reducer, awards); 1,754 unit
tests; `e2e/survey-says.spec.ts` plays the whole round with three players in the
emulator — every guess revealed `top [0]`, counts `[2,1,0,0]`, no picks
published on a tell, right guessers scored, the wrong one didn't, the member saw
the counts, all three banked — which also proves **R1: no rules change** (the
host's reveal is its ordinary room write). Full e2e 21/21. Screenshots checked at
1280 and 375 px. **Not done: V3**, a real office round.

## Open — Greg to decide

| Decision | Owner |
|---|---|
| Approve the story and the cut (four options, part one then part two, 5 prompts × 2) | Greg |
| **The host can see part one's tallies before part two.** Members cannot. The vault exists so even the host can't peek, but a survey has no answer to vault without a server, which Spark doesn't have. Accept for the office, as drafted? | Greg |
| All-or-nothing for the top answer (as drafted), or ranked points for 2nd and 3rd | Greg |
| Who writes the first 40 prompts: me, as a draft for you to cut, or you | Greg |
