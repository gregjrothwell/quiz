/**
 * Which league a player's record belongs to — Engineering against Marketing,
 * rather than one office-wide list.
 *
 * Free text rather than a fixed list, because the list would have to be
 * configured somewhere and every office would need a different one. The cost of
 * free text is the obvious one: "Engineering", "engineering" and " Engineering "
 * are three leagues on a board that should show one. {@link teamKey} is what
 * stops that — grouping is done on a normalised key while the table still shows
 * the name as it was typed.
 */

/** Matches the bound in firestore.rules, which is what actually enforces it. */
export const MAX_TEAM_LENGTH = 40;

/**
 * A team name as the season should hold it, or the empty string for no team.
 *
 * Applied on the way out of storage as well as in, for the same reason
 * `cleanName` is: what is in storage is whatever an earlier build wrote there.
 */
export function cleanTeam(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.trim().slice(0, MAX_TEAM_LENGTH).trim();
}

/**
 * What two spellings of the same team have in common.
 *
 * Case and surrounding space only. Nothing cleverer — collapsing "Eng" into
 * "Engineering" would need a dictionary, and quietly merging two teams somebody
 * meant to keep apart is worse than showing both.
 */
export function teamKey(team: string): string {
  return cleanTeam(team).toLowerCase();
}

/**
 * Every team on the board, in the order they should be offered.
 *
 * Sorted, and de-duplicated on the key rather than the name, so a board holding
 * both "Engineering" and "engineering" offers one filter and not two. The first
 * spelling seen wins, which is arbitrary but stable given the rows arrive
 * sorted by points.
 */
export function teamsOf(records: { team?: string }[]): string[] {
  const seen = new Map<string, string>();

  for (const record of records) {
    const team = cleanTeam(record.team);
    if (team && !seen.has(teamKey(team))) seen.set(teamKey(team), team);
  }

  return [...seen.values()].sort((a, b) => a.localeCompare(b, 'en-GB'));
}
