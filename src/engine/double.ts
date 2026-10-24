import { roomStandings, standings } from './scoring';
import type { FirstHalf, RoomState } from './state';

/**
 * The Double: two rounds in one room that add up to one morning, with one
 * final at the end of the second. docs/decisions/morning-double.md.
 *
 * Round two scores from zero like any round, so its rank bonus, steal and
 * wager work as they always have. What changes is what the boards rank by and
 * what the final stakes: the morning, which is round one plus round two.
 */

/**
 * Round one plus round two, per player. Everyone who played either round is
 * on it: somebody who joined at half-time starts on nothing, and somebody who
 * left keeps what they had. Outside a double, it is just the round.
 */
export function morningTotals(room: Pick<RoomState, 'double' | 'scores'>): Record<string, number> {
  if (!room.double) return room.scores;
  const totals: Record<string, number> = { ...room.double.scores };
  for (const [uid, score] of Object.entries(room.scores)) {
    totals[uid] = (totals[uid] ?? 0) + score;
  }
  return totals;
}

/** Round one of a double, over, with round two still to come. */
export function isHalfTime(room: Pick<RoomState, 'phase' | 'doubleEnabled' | 'double'>): boolean {
  return room.phase === 'finished' && room.doubleEnabled && room.double === null;
}

/**
 * Whoever tops the morning, among the players given — the table as it stood at
 * the whistle. More than one after a shared final, which makes joint winners.
 * Empty when nobody scored, because a morning where nobody scored is not a win
 * for everybody.
 */
export function morningChampions(
  players: Record<string, unknown>,
  scores: Record<string, number>,
  double: FirstHalf | null,
): string[] {
  // Filtered before ranking, so somebody who left on top of the morning does
  // not hold first place away from everybody still there.
  const totals = Object.fromEntries(
    Object.entries(morningTotals({ double, scores })).filter(([uid]) => players[uid]),
  );
  const rows = standings(totals);
  const lead = rows[0]?.score ?? 0;
  if (lead <= 0) return [];
  return rows.filter((row) => row.position === 1).map((row) => row.uid);
}

/**
 * Whether this player's round banks as a win. Outside a double, and in round
 * one of one, the top of the round. In round two, the top of the morning — so
 * the win of a double goes to whoever won the double, not whoever had the
 * better second round.
 */
export function seasonWin(
  players: Record<string, unknown>,
  scores: Record<string, number>,
  double: FirstHalf | null,
  uid: string,
): boolean {
  if (double) return morningChampions(players, scores, double).includes(uid);
  // As `App.tsx` banked it before the Double, unchanged. `roomStandings` ranks
  // before it filters, so a leaver on top leaves nobody in first place.
  const rows = roomStandings(players, scores);
  const lead = rows[0]?.score ?? 0;
  return lead > 0 && rows.find((row) => row.uid === uid)?.position === 1;
}
