import { roomStandings } from './scoring';
import type { Player } from './state';

/**
 * Share or Shaft — the final a room can choose to end on.
 *
 * After the last question the top two play for both their scores: they talk it
 * over out loud, then each picks in secret. Both share and they split the pot,
 * level, as joint winners. One shafts and takes the lot. Both shaft and both go
 * home with nothing, which hands the round to whoever was third.
 *
 * The words are the show's own — *Shafted*, ITV, 2001 — and the decisions
 * behind every rule here are in docs/decisions/share-or-shaft.md.
 *
 * Everything in this file is a pure function of what every client already
 * holds, so the settlement is identical on every device.
 */

export const STANDOFF_PICKS = ['share', 'shaft'] as const;
export type StandoffPick = (typeof STANDOFF_PICKS)[number];

/**
 * `talk` is sixty seconds out loud on the call — nothing in the app, which is
 * the point. `pick` is the blind choice: each finalist commits to a sealed pick.
 * `closed` is the whistle — no further commitment counts, and the finalists'
 * devices open theirs. `revealed` has both picks turned over and the scores
 * settled, and holds until the quizmaster moves to the results.
 *
 * **Reveals wait for `closed`, not for both commitments.** Waiting for both
 * would leave a finalist whose opponent never picked unable to reveal at all —
 * and revealing on a timer instead would let a late opponent read the pick and
 * then commit. Closing is one write by the quizmaster, and after it nothing new
 * can count, so opening a pick can no longer give anything away.
 */
export type StandoffStage = 'talk' | 'pick' | 'closed' | 'revealed';

export interface Standoff {
  /** Exactly two uids, the leader first. */
  finalists: [string, string];
  /**
   * What each finalist put in: their score above zero, taken once as the final
   * opens. Fixed then rather than read at the settle, so nothing that lands on
   * the scores in between — a late echo, a stray write — can change what either
   * of them is playing for.
   */
  stakes: Record<string, number>;
  stage: StandoffStage;
  /**
   * Which finalists had committed when the picking closed. Null before then.
   * Only these picks can count: a commitment that lands after the whistle could
   * have been made after reading an opponent's reveal.
   */
  sealed: string[] | null;
  /**
   * Null until settled. After that, one entry per finalist: their verified pick,
   * or null for one that never arrived — which counts as share and is recorded
   * as what it was.
   */
  picks: Record<string, StandoffPick | null> | null;
}

/** Talking time, counted on each screen from when it saw the final open. */
export const TALK_MS = 60_000;

/** Picking time, counted the same way. */
export const PICK_MS = 15_000;

/**
 * How long past its own pick clock the quizmaster waits before closing, for a
 * commitment still in flight. Every other screen saw the stage open a hop later
 * than the quizmaster did, so a finalist tapping on their last second is
 * tapping after the quizmaster's clock has already run out.
 */
export const PICK_GRACE_MS = 3_000;

/**
 * How long the quizmaster waits for the reveals once the picking has closed. A
 * finalist's device opens its pick the moment it sees the close, so this only
 * runs out for a device that has gone — and that finalist then counts as
 * sharing, which never helps them.
 */
export const REVEAL_GRACE_MS = 5_000;

export function isStandoffPick(value: unknown): value is StandoffPick {
  return value === 'share' || value === 'shaft';
}

/**
 * A number that orders players differently in every game and identically on
 * every device. FNV-1a over the game and the uid — nothing needs to be secret
 * here, only fair.
 */
function coin(gameId: string, uid: string): number {
  let hash = 0x811c9dc5;
  for (const char of `${gameId}\0${uid}`) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

/**
 * The two players in the final, leader first, or null when the room has fewer
 * than two.
 *
 * Current members only — `roomStandings` filters on membership, because
 * `scores` keeps the number of somebody who has gone home.
 *
 * **A tie at the cut is settled by a coin seeded from the game**, not by the
 * board's own order. `standings` breaks a tie on uid, which is fixed per device,
 * so the same one of two colleagues would win every tie for a place in the
 * final for the rest of the season.
 */
export function finalistsFor(
  players: Record<string, Player>,
  scores: Record<string, number>,
  gameId: string,
): [string, string] | null {
  const rows = roomStandings(players, scores);
  const cut = rows[1];
  if (!cut) return null;

  const clear = rows.filter((row) => row.score > cut.score).map((row) => row.uid);
  const level = rows
    .filter((row) => row.score === cut.score)
    .map((row) => row.uid)
    .sort((a, b) => coin(gameId, a) - coin(gameId, b) || a.localeCompare(b));

  const [first, second] = [...clear, ...level];
  return first !== undefined && second !== undefined ? [first, second] : null;
}

/**
 * What each finalist puts in: everything they hold above zero. A negative
 * score — a lost minimum stake can leave one — stays with its owner, because a
 * pot with a debt in it would make taking it a punishment.
 */
export function stakesFor(
  scores: Record<string, number>,
  finalists: readonly string[],
): Record<string, number> {
  return Object.fromEntries(finalists.map((uid) => [uid, Math.max(0, scores[uid] ?? 0)]));
}

export function potOf(standoff: Pick<Standoff, 'stakes'>): number {
  return Object.values(standoff.stakes).reduce((sum, stake) => sum + stake, 0);
}

export interface Settlement {
  scores: Record<string, number>;
  /** Finalists only — nobody else's score moves. */
  deltas: Record<string, number>;
  /** One entry per finalist, null where no verified pick arrived. */
  picks: Record<string, StandoffPick | null>;
}

/**
 * Pays out the final.
 *
 * Both share: `floor(pot / 2)` each — an odd point is dropped so the two stay
 * level, which is what makes them joint winners. One shafts: the pot to them,
 * nothing to the other. Both shaft: both lose what they put in.
 *
 * **No pick counts as share.** That is the only default that cannot be gamed.
 * Shafting is never worse than sharing for the one choosing it, so reading a
 * missing pick as share means a finalist who withholds — or whose laptop lid
 * closed — can only ever help the other finalist, never themselves.
 */
export function settleStandoff(
  scores: Record<string, number>,
  standoff: Pick<Standoff, 'finalists' | 'stakes'>,
  picks: Readonly<Record<string, StandoffPick | null | undefined>>,
): Settlement {
  const pot = potOf(standoff);
  const recorded: Record<string, StandoffPick | null> = {};
  for (const uid of standoff.finalists) {
    const pick = picks[uid];
    recorded[uid] = isStandoffPick(pick) ? pick : null;
  }

  const shafters = standoff.finalists.filter((uid) => recorded[uid] === 'shaft');
  const takes = (uid: string): number => {
    if (shafters.length === 0) return Math.floor(pot / 2);
    if (shafters.length === 1) return shafters[0] === uid ? pot : 0;
    return 0;
  };

  const settled = { ...scores };
  const deltas: Record<string, number> = {};
  for (const uid of standoff.finalists) {
    const before = scores[uid] ?? 0;
    const after = before - (standoff.stakes[uid] ?? 0) + takes(uid);
    settled[uid] = after;
    deltas[uid] = after - before;
  }

  return { scores: settled, deltas, picks: recorded };
}

export type StandoffOutcome =
  | { kind: 'shared'; each: number }
  | { kind: 'shafted'; by: string; from: string; pot: number }
  | { kind: 'bothShafted'; pot: number };

/**
 * What happened, for the screen to say in words. Null until the final is
 * settled. Read from the picks the room recorded, so every screen tells the
 * same story.
 */
export function outcomeOf(standoff: Standoff): StandoffOutcome | null {
  if (!standoff.picks) return null;
  const pot = potOf(standoff);
  const [a, b] = standoff.finalists;
  const shaftA = standoff.picks[a] === 'shaft';
  const shaftB = standoff.picks[b] === 'shaft';

  if (shaftA && shaftB) return { kind: 'bothShafted', pot };
  if (shaftA) return { kind: 'shafted', by: a, from: b, pot };
  if (shaftB) return { kind: 'shafted', by: b, from: a, pot };
  return { kind: 'shared', each: Math.floor(pot / 2) };
}

export function isFinalist(standoff: Standoff | null, uid: string | null): boolean {
  return Boolean(standoff && uid && standoff.finalists.includes(uid));
}
