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
   * Which side this device's points count for tonight, already resolved through
   * `sideFor`. Empty for somebody who has never named a squad.
   */
  squad: string;
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
  squad,
  restored,
  now,
}: JoinInput): JoinPlan {
  // Only when it differs from the uid, which needs a claimed recovery code.
  // Written unconditionally it would put a redundant copy of the uid into every
  // entry in every room, for no information at all.
  const identity = playerId === uid ? {} : { playerId };

  // Omitted rather than written empty, for the same reason. An empty string
  // would be a field on every entry in every room saying nothing, and
  // `playerOk` would have to accept it.
  const side = squad ? { squad } : {};

  const existing = players[uid];
  const entry: Player = existing ?? {
    name,
    joinedAt: restored ?? seatBehind(players, now),
    ...identity,
    ...side,
  };

  const score = scores[uid] ?? (phase === 'finished' ? null : 0);

  return { entry, score };
}

export type SeatSquadPlan =
  | { kind: 'set'; squad: string }
  | { kind: 'clear' }
  | { kind: 'skip' };

/**
 * What writing a squad onto a seat that already exists should do.
 *
 * This is not a rejoin. {@link planJoin} leaves an existing entry untouched so
 * a reconnect cannot restamp `joinedAt` and move the quizmaster. The live board
 * still needs a first-time pick that happens *after* the seat was written —
 * auto-join lands someone in the lobby with no squad, and the picker is the
 * rest of the join.
 *
 * Only the lobby. Once the show starts the side is frozen, which is the
 * running-total rule in `docs/decisions/live-squads.md`. Changing squad
 * mid-round still banks the new side and shows the old one.
 *
 * Returns a field write, never a new entry, so `joinedAt` cannot move.
 */
export function planSeatSquad({
  existing,
  phase,
  squad,
}: {
  existing: Player | undefined;
  phase: Phase;
  squad: string;
}): SeatSquadPlan {
  if (!existing) return { kind: 'skip' };
  if (phase !== 'lobby') return { kind: 'skip' };

  const held = existing.squad ?? '';
  if (held === squad) return { kind: 'skip' };
  if (!squad) return { kind: 'clear' };
  return { kind: 'set', squad };
}
