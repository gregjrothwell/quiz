# The Double — two rounds, one morning, one final

> **Owner: Greg Rothwell. Last updated: 24 October 2026. Budget: 250 lines.**

**Status: built 24 October 2026 on branch `morning-double` (`142fa8b`), not
live.** Approved by Greg the same day with the recommended answers to D1–D3:
"lobby choice, stake the whole morning, call it The Double". From the 24
October ideas list, where it was idea 1.

## Why

**The office already plays a double; the game does not know it.** Read off the
live project with `read-games -- --last 40`, 24 October 2026:

- Every office morning from 6 to 13 October was two rounds in one room, minutes
  apart: `RRGM`, `XRUE`, `XX7B`, `SAJT`, `XFJX`, `QY5X`, `MNXU` (7 of 7).
- 20, 21 and 22 October each had two morning rounds as well. Their room codes
  were not checked.

Today each round is its own show. "Another round" zeroes every score
(`reset`, `src/engine/reducer.ts:662-687`) and mints a new `gameId`, so a
morning has two winners and, with Share or Shaft on, two finals. Nothing anyone
did in round one matters once round two starts.

## The story

> **As** the office, playing two rounds before nine,
> **I want** the two rounds to add up to one morning with one final,
> **so that** round two matters to whoever won round one, and the morning has
> one winner.

## How it works today (read 24 October 2026)

| | Today | Where |
|---|---|---|
| Another round | Same room, scores to 0, new `gameId`. Wager, steal and Share or Shaft settings survive, since `reset` does not clear them | `reducer.ts:662` |
| Season | Each round banks on its own `gameId`; a retry cannot bank twice | `season.ts:182`, `records.ts:274` |
| Kept round | One `games/{gameId}` per round | [`game-record.md`](game-record.md) |
| The final | Top two **current members** by round score; the pot is each one's score above zero; it banks | `standoff.ts:114-145`, [`share-or-shaft.md`](share-or-shaft.md) |

`finalistsFor(players, scores, gameId)` and `stakesFor(scores, finalists)` take
a scores map, so a morning total can be passed straight in.

## The rules, version one

1. **A lobby choice, "Make it a double"**, under *How it ends*, off by default,
   with any pack. The quizmaster sets it for round one.
2. **Round one plays exactly as today**, wager included. But **if Share or Shaft
   is on, it is held back**: round one ends at **half-time** instead. That
   screen shows the round's standings, with **Round two** where *Another round*
   usually sits.
3. **Round one banks at half-time, exactly as an ordinary round**: its season
   rows and its `games/` record. A morning that never reaches round two loses
   nothing.
4. **Round two opens in the lobby as usual.** Any pack, the vote works, and the
   options can change, except *Double*, which shows locked on.
5. **Round two's boards rank by the morning total** (round one plus round two),
   with the round's own score beside it. The round still scores from zero:
   rank bonus, steal and wager work on the round, as today.
6. **The morning board holds everyone who played either round.**
   - Someone who joins at half-time starts the morning on 0.
   - Someone who leaves keeps their round-one total, shown as away, and counts
     again if they rejoin.
7. **The final is at the end of round two**, if Share or Shaft is on:
   - The top two **current members** by morning total go through.
   - A tie at the cut goes to the existing coin.
   - **The pot is each finalist's morning total above zero** (D2).
8. **The final settles onto round two's bank.** Each finalist's round two banks
   their settled morning total minus what round one already banked, so the
   two banked rounds add up to the outcome. This can bank a negative round two.
   That already happens with negative points, and `bankGame` sums `points` and
   takes `max` for `best` (`records.ts:287-291`).
9. **Round one's `won` goes to round one's winner** at half-time. **Round two's
   `won` goes to the morning champion**, the top morning total after any final.
   No new season field in v1.
10. **After round two, *Another round* is an ordinary round**: scores to 0,
    *Double* off. There is no treble.
11. **Round two's `games/` record names round one's `gameId`**, so `read-games`
    can print the pair.

### Worked example for rule 8

Rach: round one 6,000, round two 4,000, morning 10,000.
Joe: round one 3,000, round two 5,500, morning 8,500.
Pot 18,500.

| Outcome | Rach's round two banks | Joe's round two banks |
|---|---|---|
| Both share (9,250 each) | 3,250 | 6,250 |
| Rach shafts, Joe shares | 12,500 | −3,000 |
| Both shaft (both to 0) | −6,000 | −3,000 |

## Deleted from v1

- A treble, or best of *n*.
- The morning champion on the season table or in Quiz Wrapped.
- Steal, rank bonus or wager measured across both rounds.
- Detecting a double without the lobby choice (D1).
- Commentator lines about the morning.

## Acceptance criteria

**Lobby**
1. **Given** a fresh room, **when** the lobby shows, **then** *The Double* is
   off. Only the quizmaster sees it, as with every option; they are local to
   the quizmaster's lobby until Start (`Lobby.tsx`, read 24 Oct). *Corrected
   24 Oct while writing the tests: this said everyone sees its state.*
2. **Given** round two's lobby, **then** *The Double* shows on and cannot be
   turned off, and everyone sees "Round two of The Double". Pack, duration and
   the other options are free.

**Half-time**
3. **Given** *Double* and Share or Shaft both on, **when** round one's last
   scoreboard ends, **then** there is no final. Half-time shows the round's
   standings and a **Round two** button.
4. **Given** half-time is reached, **then** round one's season rows and its
   `games/` record are written with the same fields as an ordinary round, and
   read back from the live project (or the emulator) to prove it.
5. **Given** the room is abandoned at half-time, **then** nothing is lost, and
   the room expires as any other.

**Round two**
6. **Given** round two is running, **then** every scoreboard orders by morning
   total and shows the round score beside it.
7. **Given** someone joins at half-time, **then** they start the morning on 0.
   **Given** someone leaves, **then** their total stays on the board marked away,
   and they cannot be a finalist.
8. **Given** a reload, or a host claim mid-round two, **then** round-one totals
   survive. They live on the room document, not in a client's memory.

**The final and the end**
9. **Given** Share or Shaft is on, **when** round two ends, **then** the
   finalists are the top two current members by morning total, and the coin
   breaks a tie at the cut.
10. **Given** the final settles, **then** each finalist's banked round two
    equals their settled morning total minus their round one. The three outcomes
    in the worked example must hold exactly.
11. **Given** *Double* without Share or Shaft, **when** round two ends, **then**
    it goes straight to the final card.
12. **Given** a double finishes, **then** the final card names the morning
    champion and shows each player's two round scores and morning total.
13. **Given** a double finishes, **when** the quizmaster takes *Another round*,
    **then** it is an ordinary round: scores 0, *Double* off.

**Record, cost, rules, release**
14. Round two's `games/` record carries round one's `gameId`, and `read-games`
    prints the two as a pair.
15. **Cost:**
    - No new listener and no new subcollection.
    - At most one new field on the room, bounded by `maxPlayers()` entries.
    - Members cannot write it: their writes are limited to `players`, `scores`,
      `packVotes` and `voteTaps` (`firestore.rules:410`).
16. **Rules: one change, to `games/`.** *Corrected 24 Oct while writing the
    tests: this said no rules change.*
    - The room needs none: its top-level keys are not pinned (`wellFormed`,
      `firestore.rules:329-339`), as the wager's flag says in `state.ts`.
    - **Rule 11's link does.** The games block `hasOnly`s its keys
      (`firestore.rules:933`), so `doubleOf` must be listed, or round two is
      refused silently and never kept.
    - **Optional, not required.** It goes in `hasOnly` but not `hasAll`, as a
      string of at most 64 characters when present. A bundle from before the
      Double writes no such key, and requiring it would refuse every round a
      stale bundle keeps.
    - Proof: one allow and two denies in `check-rules`; the e2e spec writes
      round two through the real host against the repo's rules.
17. **Release:** a What's new line in `src/lib/updates.ts`.
18. **Live check:** the first office double. `read-games` shows the two rounds
    paired, and the banked rounds add up to each finalist's outcome.

**Where the tests go:**
- Pure engine cases in `src/engine/`: the morning total, finalists from it,
  settling onto round two, and the morning surviving `reset` while scores go
  to 0.
- One Playwright spec: a two-round double with a final, against the emulators.

## The tests — written red 24 October 2026, green with `142fa8b`

| File | Covers | Red because |
|---|---|---|
| `src/engine/double.test.ts` | Rules 1–10, AC1–AC13, the worked example, `seasonWin` | `./double` does not exist (28 cases, 3 of them one `test.each`) |
| `src/engine/gameRecord.test.ts` | Rule 11, AC14, the rules' key list | no `doubleOf`, no `GAME_RECORD_OPTIONAL_KEYS` |
| `src/lib/roomDoc.test.ts` | AC8; old rooms; junk dropped; no `players` write; deleted on reset | no `double` on the room |
| `src/screens/Lobby.double.test.tsx` | AC1, AC2 | no choice in the lobby |
| `src/screens/Final.test.tsx` | AC3, AC12, AC13 | no half-time, no morning |
| `e2e/double.spec.ts` | AC3, AC4, AC9, AC10, AC14 end to end, real host, emulators | no `roundTwo`, no `doubleEnabled` (not run yet) |
| `scripts/check-rules.ts` | AC16, live | run after the rules merge, not before |

`npm test`, 24 Oct: **18 failed, 1,966 passed**. All 18 are the Double's,
`double.test.ts` fails to load, and every existing test still passes. 5 new
cases pass already because they guard what must not change (only the
quizmaster sees the choice; round one says nothing of a round two; an
ordinary transition writes no first half; an ordinary round after a double).
`tsc`: 39 errors, every one a missing piece of the Double. Lint clean.

Not covered by an automated test: season banking at half-time (AC4's season
half). Banking runs per device in `App.tsx`, which no test drives. `seasonWin`
is tested, and the first office double is the live check (AC18).

## Built — 24 October 2026

All 2,015 offline tests green; `e2e/double.spec.ts` passed against the emulators
in 2.2 minutes (the real Node host, both rounds, the final, both records kept
under the repo's rules). Seen in the gallery at desktop and 375px.

- **Ordinary rounds bank exactly as before.** `seasonWin` keeps the old rule
  word for word outside a double.
- **Found, not fixed: a win can go unbanked.** `roomStandings` ranks before
  it filters out leavers, so when the top scorer leaves before the whistle
  nobody else is in first place and no win banks. Pre-existing in `App.tsx`;
  the Double's own champion ranks only who was there.
- **Found on screen: two things called "round two".** The scoreboard's title
  card calls each *question* a round ("Round two", "Round three"), so in round
  two of a double "Round two" means both. For Greg: keep it, or call the
  halves "first half" and "second half", which half-time already suggests.
- **Phones:** the round's score beside a name pushed the name off the row at
  375px; it now drops under the name below 640px.

## Choosing the number of rounds — not now (24 October 2026)

Greg raised it; the kept rounds say not yet. Of 53 room-days in `read-games
-- --last 200`, 36 played one round, 15 two, and 2 three: one a solo test
(`QFME`), one a real sitting of four (`T9JG`, 24 September). Four never.
Against it as well: the morning stops at nine, a three-round pot is three
rounds on one decision, and "Round three" already names a question.
Waiting costs nothing: round one lives on the room, which expires, so the
shape can change later without a migration. Greg, 24 Oct: carry on with
other features. **Revisit if three-round sittings start to appear.**

## Decided — Greg, 24 October 2026: the recommended column, all three

| # | Question | Recommended | Alternative |
|---|---|---|---|
| D1 | How does a double start? | **Lobby choice for round one.** The final must be held back before round one ends, so it has to be known in advance | Automatic whenever *Another round* follows within ~15 minutes. Then round one's final cannot be held back |
| D2 | What does the final stake? | **The whole morning.** Matches the 24 September call: if it costs little, shafting is free | Round two's score only. Simpler; round one stays untouched |
| D3 | The name | **The Double.** It is played at other times too (22 October, evening rounds) | The Morning Double |
