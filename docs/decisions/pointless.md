# Pointless, room edition — story and acceptance criteria

> **Owner: Greg Rothwell. Last updated: 24 October 2026. Budget: 250 lines.**

**Status: story drafted 24 October 2026, waiting for Greg's approval. No code.**
Greg: "write the story and ACs for Pointless (room edition). No code for
Pointless until I approve." Idea 2 of the 24 October ideas list. Code claims
below were read on `43f14ee` (master), 24 October 2026.

## The idea

*Pointless* (BBC One, since 2009) with the office as the hundred people. Three
of the four options are right and one is a trap. Avoid the trap, then pick the
right answer **the fewest people in this room picked**. Alone on a right answer:
*Pointless!*, and the full points.

- **Survey Says turned inside out.** Survey Says pays for guessing what most of
  the room said; this pays for guessing what the room *won't* say. It reuses
  Survey Says' machinery: the host counts the picks and the reveal carries them
  (`counts`, read on the reducer's `reveal`, built 22 October).
- **It needs knowledge as well as nerve.** The trap is what keeps it a quiz:
  a confident pick of the wrong answer scores nothing.
- **British, and the room is the data.** The only licensed part is the name of
  a pack, as with Catchphrase and The Price is Right.

## How a question plays

1. *"Name a … : one of these is wrong."* Four options, the usual clock.
2. Everyone picks one. Nobody sees anyone else's pick, as on every question.
3. The reveal marks the trap, shows "N picked this" on each lectern, and stamps
   *Pointless!* on any right answer one person picked.
4. **1,000 points are split between everyone who picked the same right
   answer**, rounded down. The trap scores 0, and so does no answer.

Worked example, eight seats; A, B and C right, D the trap:

| Picks | A ×4 | B ×2 | C ×1 | D ×1 |
|---|---|---|---|---|
| Each scores | 250 | 500 | **1,000, Pointless!** | 0 |

## Cut to essentials

- **Four options, three right, one trap, fixed.** The engine is built on four
  options, and one trap is enough to keep it a quiz.
- **No speed bonus.** Picks stay hidden until the reveal, so answering early
  tells you nothing and earns nothing. The rank bonus stays on every other pack.
- **No wager, steal or jigsaw** on this pack in v1, as with Survey Says. Steal
  pays the fastest right answer, which means nothing here. Share or Shaft stays.
- **Hand-written prompts only**, for a British office (AGENTS.md). About 40 to
  start; a round deals 10.
- **The trap is the vault's answer.** The vault confirms exactly one option per
  question (`resolveAnswer`, `src/lib/vault.ts:75`), so it holds the trap and
  needs no change to the vault, its rules or its shape. Seeded like any pack
  (`seed-vault -- --pack pointless`) before the pack ships.
- **Not in v1:** typed answers (the real show's way, and a project of its own),
  more than one trap, and a jackpot round.

## The story

> **As a player**, I want a round where a right answer is worth more the fewer
> of us thought of it, **so that** knowing the obscure answer and reading the
> room both win, not just being quick on the obvious one.

## Acceptance criteria

### The pack

- **K1.** `public/packs/pointless.json` holds each prompt, its four options, and
  no answer field. `seal.test.ts` still passes.
- **K2.** A test checks the count, four distinct options per prompt, and that
  every prompt's trap is seeded in the vault spec (and nowhere under `public/`).
- **K3.** Every prompt reads as British-office ordinary (AGENTS.md); nothing
  needs American knowledge.

### Scoring

- **S1.** A pick of the trap scores 0. No pick scores 0.
- **S2.** A right pick scores `floor(1000 / k)`, where `k` is how many in the
  room picked that same option, the picker included.
- **S3.** A right pick nobody else made is *Pointless!*: 1,000, and the reveal
  says so on that lectern.
- **S4.** No speed bonus on this pack; elapsed time changes nothing.
- **S5.** The worked example above holds exactly, as a unit test.

### The reveal

- **V1.** The host resolves the trap through the vault, counts every pick from
  the answers it alone can read (W3), and publishes both in the reveal write,
  as Survey Says does. Every device reads the counts off the room update.
- **V2.** Each lectern shows "N picked this"; the trap is marked wrong, the
  three right options right.
- **V3.** A member never learns another member's pick before the reveal (the
  W3 guarantee, unchanged).

### Lobby and round

- **L1.** The quizmaster picks **Pointless** like any pack. The lobby hides
  stakes, steals and jigsaw for it, and keeps Share or Shaft and the window.
- **L2.** Standings, the podium, finals and the season table work as in every
  other round.

### Rules and records

- **R1.** **To be proved, not assumed:** no rules change. The trap goes through
  the ordinary vault, and the counts ride the host's ordinary reveal write. If
  any rule turns out to need changing, it ships with an allow case on the
  host's real path and the matching denies, run with `check-rules`.
- **R2.** The `games/` record keeps every pick and the counts, so `read-games`
  can show how the room split.

### Proof before done

- **D1.** Unit tests: S1–S5, ties at every `k`, a room of one, a room where
  everybody picked the trap.
- **D2.** An emulator test plays a whole Pointless round with three players
  through the real host: vault reveal of the trap, counts on the room, the
  scores, and the round kept.
- **D3.** One real office round before it is called done.

## Measured, and worth knowing before building

- **Room size decides the spread.** Kept rounds run at 3–11 seats, 45 of 67
  at 7–9 (`read-games -- --last 200`, 24 Oct, solo tests left out). At three
  or four a right pick is often alone, so 1,000 is common; at eleven a crowded
  option pays ~90. That swing is the game, but a small round will score high.
- **Survey Says has not been played yet.** It went live 22 October, and no
  kept round has used it since (the last office round was 23 October; today is
  Saturday). Pointless leans on the same counts pipeline, so building before
  Survey Says' first office round would build on an untested base.

## Open — Greg to decide

| # | Question | Recommended | Alternative |
|---|---|---|---|
| P1 | When does the build start? | **After Survey Says' first office round reads clean**, since Pointless reuses its pipeline | Now, in parallel |
| P2 | **Is Pointless blind for you?** | Ask before any sample prompt is shown here or in chat, as for Catchphrase and the Price packs (none shown so far) | — |
| P3 | Who writes the first 40 prompts | Me, as a draft for you to cut — unless P2 is "blind", then a reviewer who isn't you | You |
| P4 | Scoring | **1,000 split between those who picked it** (S2) | The show's way: lowest wins. Breaks every other pack's "higher is better" and the season table |
