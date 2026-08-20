/**
 * Which week a game belongs to, so the office has something between "tonight"
 * and "the whole season".
 *
 * The identifier is a season id, deliberately. `seasons/{season}/players/{id}`
 * takes an unconstrained wildcard, so a week bucket is the same document shape
 * under a different name and needs no rules change at all — which matters a
 * great deal here, because every hand-pasted ruleset in this project's history
 * has broken the game.
 */

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

/** Monday is 0, which is what every calculation below wants. */
function mondayBased(date: Date): number {
  return (date.getDay() + 6) % 7;
}

/**
 * The ISO-8601 week a moment falls in, as `week-2026-W34`.
 *
 * ISO rather than anything simpler, because the obvious alternatives are all
 * wrong at exactly the point somebody notices: dividing the day of the year by
 * seven puts a Sunday and the Monday after it in the same bucket, and using the
 * calendar year splits the week that straddles New Year in half.
 *
 * Two rules do all the work: **a week starts on Monday**, and **week 1 is the
 * week containing the first Thursday of the year**. The second is why the year
 * in the id is not always the year in the date — 31 December 2024 is a Tuesday
 * and belongs to `week-2025-W01`, and 1 January 2027 is a Friday and belongs to
 * `week-2026-W53`. Both are in the tests, because they are the only part of
 * this anybody gets wrong.
 *
 * **Local time, not UTC.** Everyone playing is in the same office, and a week
 * that starts at midnight Monday *here* is the one people mean. The cost is
 * that a player somewhere else, playing within a few hours of midnight on a
 * Sunday, could bank into the adjacent week — which is a real limitation and
 * not worth a timezone library to close.
 */
export function weekId(at: Date): string {
  // Midnight local, so the arithmetic below cannot be dragged across a boundary
  // by the time of day.
  const day = new Date(at.getFullYear(), at.getMonth(), at.getDate());

  // The Thursday of this week decides which year the week belongs to. That is
  // the whole of the year-straddling rule, expressed as one move.
  day.setDate(day.getDate() - mondayBased(day) + 3);
  const year = day.getFullYear();

  // Week 1 is the one containing 4 January, which is equivalent to "the first
  // Thursday" and far easier to compute.
  const fourth = new Date(year, 0, 4);
  const firstThursday = new Date(year, 0, 4 - mondayBased(fourth) + 3);

  // Rounded rather than floored: the clocks go forward inside some of these
  // spans, so the difference is an hour short of a whole number of weeks twice
  // a year. An hour in 168 rounds correctly and would truncate wrongly.
  const week = 1 + Math.round((day.getTime() - firstThursday.getTime()) / MS_PER_WEEK);

  return `week-${year}-W${String(week).padStart(2, '0')}`;
}
