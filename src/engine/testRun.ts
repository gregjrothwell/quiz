/**
 * Whether a round was a test rather than the office (PROJ-74).
 *
 * Two kinds reach the live project. The harnesses (`rank-harness`,
 * `final-harness`, `host-room`, `sync-harness`) mint their own game ids, and
 * keep their round in `games/` because that is how they prove the live path.
 * Hand tests on the live site seat only names with "test" in them (`CC test`,
 * `G TEST`, `Test Jo`). One real name at the table keeps the round.
 *
 * Measured on 29 October 2026 against all 79 kept rounds: this flags the
 * eleven PROJ-74 named and nothing else. The `Claude` season row was the
 * browser seat of a `rank-harness --browser` run, so the id catches it.
 *
 * A test round is not banked to the season table, and every reader of
 * `games/` skips it. docs/decisions/test-runs.md.
 */

/** Game ids the harnesses mint. `rank-ed` is not one. */
const HARNESS_ID = /^(rank|final|host)-\d+$|^harness-game$/;

const TEST_NAME = /test/i;

/** Why a round was a test, or undefined for a real one. */
export function testRunOf(gameId: string, names: readonly string[]): 'harness run' | 'test run' | undefined {
  if (HARNESS_ID.test(gameId)) return 'harness run';
  if (names.length > 0 && names.every((name) => TEST_NAME.test(name))) return 'test run';
  return undefined;
}

/** The names on a `players` map as stored, whatever shape it arrives in. */
export function seatedNames(players: unknown): string[] {
  if (typeof players !== 'object' || players === null) return [];
  return Object.values(players).map((player: unknown) => {
    const name: unknown = typeof player === 'object' && player !== null ? Reflect.get(player, 'name') : undefined;
    return typeof name === 'string' ? name : '';
  });
}
