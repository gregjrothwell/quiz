# Beat the Chaser — story and acceptance criteria

> **Owner: Greg Rothwell. Last updated: 23 October 2026. Budget: 250 lines.**

**Status: APPROVED 22 October 2026, as recommended.** Greg: *"Approve all four stories as recommended: Mr Fries on pack×difficulty rates, room wins on more than half right, 🍟 until there's art, fix HANDOVER item 8; rig probe now and rig only on a pass; Commentator without Gemini, spoken from the host only, you draft ~30 lines; Wrapped's five cards opening 5 D[ec, Christmas finale left out for now]"* (the message was cut at 300 characters; the bracket is the rest of the button he pressed). Wow item 2 of
[`direction-oct-2026.md`](direction-oct-2026.md#5-wow--all-five-accepted), and
item 3 of the sequence (the per-question stats fold) folded in, because the
measurement below changes what that fold can do.

## The measurement first — it changes the plan

Read from `games/` with the Admin SDK, 22 October 2026: **65 office rounds,
934 distinct questions, 6.3 answers each.** Six questions have been asked
twice. That is the no-repeats rule working (`repeats.md`), and it means:

- **No question that will be served next has any office history.** A
  per-question rate exists only for questions the office will not see again.
- So **"Mr Fries is right exactly as often as the office is on each question"
  cannot be per question.** It can be per *group*, and the groups are real:

| Group | Questions | Right |
|---|---|---|
| Labelled easy | 243 | **77%** |
| Labelled medium | 381 | **64%** |
| Labelled hard | 286 | **50%** |
| Video Games / Tags (lowest packs) | 35 / 10 | 24% / 29% |
| Screens / Catchphrase (highest) | 130 / 95 | 86% / 86% |

  Within a group single questions still spread widely (standard deviation 34
  points), so the group rate is a fair average, not a prediction.
- **The stats fold does not fix the Ladder.** The Ladder runs dry on *unplayed*
  easy and hard questions; a fold of what was played rates only questions that
  will never come back. `HANDOVER.md` item 8 and `what-to-build-next.md` §3
  say otherwise and are wrong on this point. The Ladder needs a different fix
  (re-rating the unrated ~10,000 by some other signal), not in this story.

So the fold is still worth building, but as **the office's hit rate per pack
and difficulty** — the number Mr Fries plays to.

## The story

> **As the room**, I want to play a round together against Mr Fries, who gets
> each question right about as often as this office does, **so that** we are
> on one side for once and the score is us against the house.

## How a round plays

- A lobby option, like the wager and the steal: **"Against Mr Fries"**. Any
  pack except Survey Says.
- Every question as now: everybody answers, the reveal scores as now.
- **At each reveal Mr Fries shows his answer** beside the room's. He is right
  with probability = the office rate for that question's pack and difficulty
  (falling back to the difficulty rate, then 62% overall, when a group has fewer
  than 30 answers).
- **The room takes the question** if more than half of those who answered got
  it right. **Mr Fries takes it** if he is right. Both, neither, or one.
- At the end: *"The office 7 – 5 Mr Fries"*. Individual scores, the season and
  the podium carry on exactly as now; this is a second scoreboard on top.

## Acceptance criteria

**Stats**
- **S1.** `npm run fold-rates` (Admin SDK, dry run by default, `--go` writes)
  folds `games/` into `public/packs/rates.json`: right/answered per pack ×
  difficulty, per difficulty, and overall. Harness rounds are excluded by id.
- **S2.** The file holds counts and rates only — no question ids, no answers,
  no names. `seal.test.ts` is extended to check it.
- **S3.** Re-running on unchanged data writes an identical file.

**Mr Fries**
- **C1.** His pick is decided by the host at the reveal from
  `hash(gameId, questionId)` and the rate, so every device can recompute it and
  nobody can steer it. Wrong picks are spread over the wrong options.
- **C2.** Over 10,000 simulated questions at a 64% rate he is right 64% ±1.5%.
- **C3.** The room's side is "more than half of those who answered"; a question
  nobody answered goes to nobody, a skipped question is not counted.
- **C4.** The running score shows on the reveal and the scoreboard, and the
  final result on the podium and on the final card.
- **C5.** Off by default; when off, nothing on any screen changes (e2e).
- **C6.** No rules change, proved by an emulator round with it on.
- **C7.** A whole round in e2e: four answers per question, Mr Fries's picks
  matching a recomputation, the final score right.

## Built 22 October 2026, branch `beat-the-chaser`

- `scripts/rates.ts` + `fold-rates.ts` → `public/packs/rates.json` (69 rounds,
  overall 63%, easy 77 / medium 64 / hard 50, 17 packs). A second `--go` wrote
  it unchanged (S3). `seal.test.ts` checks it holds counts only; a planted
  question id and an "answer" key each failed it (S2).
- `src/engine/chaser.ts`: rates, Mr Fries's pick, the room's side, the score.
  10,000 simulated questions at 64% land inside ±1.5 points (C2).
- The rate is stamped on each question when the round is dealt
  (`chaserRate`); the reducer stamps `chaser: {pick, roomTook}` at the reveal,
  so every device reaches the same verdict and the room carries it.
- Lobby: "Against the house". Reveal line, scoreboard score, podium result,
  final card top right. `games/` is unchanged (its rules `hasOnly` the keys).
- e2e `beat-the-chaser.spec.ts`: 10 questions, every pick recomputed, room took
  all 10, result on the podium (C1, C3, C4, C6, C7). `host-writes` still
  matches its recording with him off (C5).

## The intro, 23 October 2026

Before question one, on its own card, the same way the standings carry the next
round and Share or Shaft carries its own: **Against Mr Fries 🍟**, then **The
whole office vs the house**, on every screen including the host. The New
sticker stays while `MODE_NEW_UNTIL` says the mode is new (through 5 Nov 2026).
Players see **Get ready — question one is coming up** under the card.

The room is still in the lobby, so the answering clock has not started. The
host — the only device that writes the round on — opens question one three
seconds after the card goes up (`CHASER_INTRO_MS` in `src/host/due.ts`). The
moment is `chaserIntro.at` on the room, so a reload continues that wait. The
quizmaster can tap **Next question** sooner. That tap and the timer are one
open: a second `start` finds the question already open and writes nothing.
A ten-second question keeps ten seconds, because the clock starts when the
question opens. No rules change: the card is a field on the room, and
`wellFormed()` does not `hasOnly` the room's keys. The host's reveal still
measures the full window from the moment the question opens.

## Cut from v1

Mr Fries as a drawn character (`mr-fries.md` is research only); he appears as a
name and a chip emoji until there is art. No season table of office v Mr Fries.
No difficulty tuning ("make him harder").

## Decided — Greg, 22 October 2026, as recommended

| Decision | Recommendation |
|---|---|
| Approve the story, and the group rate instead of per question | Yes: per question is impossible while nothing repeats |
| The room wins a question on "more than half right" | Yes; "anyone right" makes the house almost always lose |
| Mr Fries as a name and 🍟 until there is art | Yes |
| Correct `HANDOVER.md` item 8 (the fold does not fix the Ladder) | Yes |
