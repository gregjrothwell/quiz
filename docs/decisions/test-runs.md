# Test runs on the live project

> **Owner: Greg Rothwell. Last updated: 29 October 2026. Budget: 250 lines.**

**Status: built 29 October 2026, not live.** PROJ-74.

## The problem

Tests reach the live project two ways, and both landed on the season table the
office reads. On 28 October live had 10 test rows across `season-2` and weeks
W40–W43 (`CC test` ×2, `Claude`, `G TEST`), deleted that day on Greg's OK, and
`games/` held 11 test rounds that every reader counted.

- **Harnesses.** `rank-harness`, `final-harness`, `host-room` and `sync-harness`
  mint their own game ids and keep their round in `games/`, because the kept
  round is how they prove the live path. Only `rank-harness --browser` banks,
  for its one browser seat: that seat was the `Claude` row
  (`rank-1792097239825`, read 29 October).
- **Hand tests** on the live site, by Greg or a Claude session: seats named
  `CC test`, `G TEST`, `Test Jo`. These bank through the ordinary client path.

## The rule

`testRunOf(gameId, names)` in `src/engine/testRun.ts`: a harness id
(`rank-<n>`, `final-<n>`, `host-<n>`, `harness-game`), or a table where
**every** name contains "test". One real name keeps the round.

Measured on 29 October against all 79 kept rounds: it flags exactly the eleven
PROJ-74 named (five harness ids, six test tables) and nothing else. It was not
widened to `Claude` or `check`, because nothing else needed it.

## What it does

The ticket offered two answers: keep tests off prod entirely, or tag them.
Neither works alone. Off prod entirely would stop the harnesses, which are the
live proof. Tagging alone leaves test rows on the board the office sees. So:

| Where | A test round |
|---|---|
| Season and week rows | **Not banked.** `App.tsx` returns before `recordGame` |
| `games/` | Still kept by the host, as before |
| `backfill-finals`, `backfill-rivals`, `fold-rates`, `freshness`, `audit-players`, `read-owed`, `read-cannon` | Skipped, and the count is printed |
| `read-games` | Shown, tagged `· harness run` / `· test run`, because that is where a harness run is read back |

Not covered: `read-traces` looks rounds up by id from device traces and still
names test seats. The `asked` history (`seasons/*/asked`) is written by the
host during the round and is not filtered, so a test round still marks its
questions as asked.

**For a live check by hand, put "test" in every seat's name**, or the round
banks like any other.

## Evidence

- `e2e/test-run.spec.ts`: two seats, `CC test` and `Test Ann`, play a General
  Knowledge round through the app. Against the unfixed app it **fails**
  (`season-2/<uid>` exists); fixed, it passes, and `games/{id}` exists. The
  allow direction, a real table banking all three seats, is
  `survey-says.spec.ts`, run alongside: 2 passed.
- Live readers, read-only, 29 October: `backfill-finals` and `audit-players`
  skip 11, `fold-rates` 79 read and 11 skipped, `read-owed` 7 of its last 40,
  `read-games` tags 11.
