/**
 * How the season table is ordered.
 *
 * It used to rank on lifetime points, which rewards turning up rather than
 * playing well: ten mediocre rounds beat three good ones, and the only way to
 * climb was to keep showing up. Ranking on points ÷ played says something about
 * how somebody plays instead of how often.
 *
 * `played` has been stored since the first version of the board, so this costs
 * no new field, no rules republish and no migration — the number to rank on was
 * already in the table.
 */

/**
 * Rounds below this are too few to mean anything.
 *
 * Without a floor the board is led by whoever played once and got lucky, and a
 * single good night would outrank a season of them — which is the same
 * complaint as the points board, pointed the other way.
 *
 * Three rather than five, because the office plays weekly and five would leave
 * a new starter unranked until December. They are listed rather than hidden:
 * somebody who has played twice should see themselves on the board, and be able
 * to see what they are two rounds away from.
 */
export const MIN_GAMES_TO_QUALIFY = 3;

/** The only two fields the ordering actually needs. */
interface Scored {
  points: number;
  played: number;
  name: string;
}

/**
 * Points per round.
 *
 * Guarded against zero rounds, which `bankGame` cannot produce — it increments
 * `played` on every write — but which `firestore.rules` permits, and which is
 * what a hand-edited row would look like. Zero is the honest answer for
 * somebody who has never finished a round; a division by zero would put them
 * top of the board.
 */
export function averageFor(row: { points: number; played: number }): number {
  return row.played > 0 ? row.points / row.played : 0;
}

export interface RankedTable<T> {
  /** Ranked, best average first. */
  ranked: T[];
  /** Too few rounds to rank, ordered the same way and shown below the table. */
  provisional: T[];
}

/**
 * Two tie-breaks after the average, and both exist for the same reason as the
 * awards' sorted joint winners: **every device has to render the same order.**
 * Ties would otherwise follow whatever order Firestore happened to return, and
 * two people looking at the same board would see different positions.
 *
 * `played` breaks a tie first because the same average over more rounds is the
 * better claim on it. The name is the last resort and is compared with
 * `en-GB`, so it does not depend on the device's locale either.
 */
function byAverage(a: Scored, b: Scored): number {
  const difference = averageFor(b) - averageFor(a);
  if (difference !== 0) return difference;

  if (b.played !== a.played) return b.played - a.played;
  return a.name.localeCompare(b.name, 'en-GB');
}

/**
 * Splits a table into the part that is ranked and the part that is not yet.
 *
 * Sorted on the **exact** average rather than the rounded one the screen shows.
 * Two rows can therefore display the same number with one above the other,
 * which is ordinary for any rounded leaderboard — where sorting on the rounded
 * value would need a further tie-break and would sometimes put the genuinely
 * higher average underneath.
 *
 * Takes a readonly array and returns new ones. `loadTable` hands out a copy of
 * a cached array, and an in-place sort here would quietly reorder the cache for
 * every later read rather than failing where it was written.
 */
export function rankByAverage<T extends Scored>(rows: readonly T[]): RankedTable<T> {
  const ranked: T[] = [];
  const provisional: T[] = [];

  for (const row of rows) {
    (row.played >= MIN_GAMES_TO_QUALIFY ? ranked : provisional).push(row);
  }

  return {
    ranked: ranked.sort(byAverage),
    provisional: provisional.sort(byAverage),
  };
}
