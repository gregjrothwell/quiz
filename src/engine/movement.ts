import { roomStandings } from './scoring';

export interface BoardMoves {
  /** uid → places climbed (positive) or dropped (negative). Absent when unmoved. */
  moves: Record<string, number>;
  /** Whoever now leads on their own and did not lead before, or null. */
  newLeader: string | null;
}

export const NO_MOVES: BoardMoves = { moves: {}, newLeader: null };

/**
 * What the last question did to the order, for the standings to say out loud.
 *
 * The board before is worked back from the board after and the deltas the
 * question paid out, rather than remembered: every device already holds both,
 * so every device tells the same story, a reload included. Positions are the
 * board's own — joint places share a number — so moving from joint second to
 * second on your own is not a move, and nor is a tie that was already a tie.
 *
 * A new leader is somebody who leads *alone* now and did not lead alone
 * before. A share of first is nobody's lead, in either direction: catching the
 * leader exactly takes nothing, and pulling clear of a tie takes it outright —
 * which is also why the first question, with everyone level on nothing,
 * crowns whoever pulls clear.
 */
export function boardMoves(
  players: Record<string, unknown>,
  scores: Record<string, number>,
  deltas: Record<string, number>,
): BoardMoves {
  if (Object.keys(deltas).length === 0) return NO_MOVES;

  const before: Record<string, number> = {};
  for (const [uid, score] of Object.entries(scores)) before[uid] = score - (deltas[uid] ?? 0);

  const then = roomStandings(players, before);
  const was = new Map(then.map((entry) => [entry.uid, entry.position]));
  const now = roomStandings(players, scores);

  const moves: Record<string, number> = {};
  for (const entry of now) {
    const prior = was.get(entry.uid);
    if (prior !== undefined && prior !== entry.position) moves[entry.uid] = prior - entry.position;
  }

  const soleLeader = (board: Array<{ uid: string; position: number }>): string | null => {
    const leaders = board.filter((entry) => entry.position === 1);
    return leaders.length === 1 ? (leaders[0]?.uid ?? null) : null;
  };
  const leaderNow = soleLeader(now);
  const leaderBefore = soleLeader(then);
  const newLeader = leaderNow !== null && leaderNow !== leaderBefore ? leaderNow : null;

  return { moves, newLeader };
}
