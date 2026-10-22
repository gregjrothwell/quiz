# Survey Says — story and acceptance criteria

> **Owner: Greg Rothwell. Last updated: 22 October 2026. Budget: 250 lines.**

**Status: DRAFT for Greg's approval. Nothing built.** The first Wow item in
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
   the reveal shows how the room split, as bars, with no names.
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
- **T3.** The reveal shows the split as four bars with counts, and **no
  names**. Nobody's own answer is exposed to the room.

### Part two — we asked the office

- **G1.** The correct answer is the option most of the room chose in part one.
  A tie for top makes every tied option correct.
- **G2.** Worked out by the host from part one's answers, which since W3 only
  the host can read. Every device then reads it off the room update, as a
  normal reveal does.
- **G3.** If fewer than 3 people answered a prompt in part one, its part-two
  question is skipped, with a line saying why. Two answers is not a survey.
- **G4.** Scoring, speed bonus, standings and the podium are unchanged.
- **G5.** The reveal shows the bars from part one again, the top answer lit.

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

## Open — Greg to decide

| Decision | Owner |
|---|---|
| Approve the story and the cut (four options, part one then part two, 5 prompts × 2) | Greg |
| **The host can see part one's tallies before part two.** Members cannot. The vault exists so even the host can't peek, but a survey has no answer to vault without a server, which Spark doesn't have. Accept for the office, as drafted? | Greg |
| All-or-nothing for the top answer (as drafted), or ranked points for 2nd and 3rd | Greg |
| Who writes the first 40 prompts: me, as a draft for you to cut, or you | Greg |
