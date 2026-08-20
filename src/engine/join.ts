import { seatBehind, type Phase, type Player } from './state';

export interface JoinInput {
  /** The room as it was read a moment ago, which is all a joiner ever has. */
  players: Record<string, Player>;
  scores: Record<string, number>;
  phase: Phase;
  uid: string;
  name: string;
  /** The season record this browser plays under, when it is not simply the uid. */
  playerId: string;
  /**
   * The place in the queue this device already held **in this room**, or null.
   * Scoped by the caller: a timestamp earned in a previous room is not a place
   * in this one, and treating it as one is how an arrival ends up ahead of the
   * people who were already here.
   */
  restored: number | null;
  now: number;
}

export interface JoinPlan {
  entry: Player;
  /**
   * What to put on the board, or null to write nothing at all — which is not the
   * same as zero. See {@link planJoin}.
   */
  score: number | null;
}

/**
 * What writing yourself into a room should say, given what the room said a
 * moment ago.
 *
 * Pulled out of `writeSelfIntoRoom` because these are the two decisions in the
 * join path that can quietly spoil a round somebody is in the middle of playing,
 * and neither is reachable from a test while it is tangled up with Firestore.
 *
 * **The seat.** An existing entry is left exactly as it is — a rejoin must not
 * restamp `joinedAt`, or a reconnecting quizmaster loses the role to whoever
 * stayed put. Failing that, the place this device held here before, so coming
 * back from a reap costs nothing. Failing that, a seat behind everyone present
 * rather than whatever this device's clock reads.
 *
 * **The board.** A score already on it is never disturbed; somebody rejoining
 * mid-round has been earning points all along. A round that has already finished
 * opens no new score at all, because `standings` is built from `scores` and a
 * zero written here puts somebody who saw none of the game onto the podium and
 * into the loser's chair. Anywhere else, a newcomer starts on zero and plays.
 */
export function planJoin({
  players,
  scores,
  phase,
  uid,
  name,
  playerId,
  restored,
  now,
}: JoinInput): JoinPlan {
  // Only when it differs from the uid, which needs a claimed recovery code.
  // Written unconditionally it would put a redundant copy of the uid into every
  // entry in every room, for no information at all.
  const identity = playerId === uid ? {} : { playerId };

  const existing = players[uid];
  const entry: Player = existing ?? {
    name,
    joinedAt: restored ?? seatBehind(players, now),
    ...identity,
  };

  const score = scores[uid] ?? (phase === 'finished' ? null : 0);

  return { entry, score };
}
