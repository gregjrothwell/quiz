import type { Phase, Player } from './state';

/**
 * How long a player must be continuously absent from presence before anyone
 * removes them. Absorbs brief reconnects — without it, a dropped WiFi packet
 * ejects someone and, worse, can hand the quizmaster role away and back again.
 *
 * Was eight seconds, which is less than a backgrounded tab, a closed lid or a
 * lock screen. Presence runs over the Realtime Database, a different connection
 * from the Firestore one the game itself uses, so any of those drops presence
 * while the player carries on entirely normally. Thirty seconds is still short
 * enough that a lobby tidies itself before anyone reads the code out.
 */
export const STALE_GRACE_MS = 30_000;

export interface ReapInput {
  players: Record<string, Player>;
  /** Uids currently listed under `presence/{code}` in the Realtime Database. */
  present: ReadonlySet<string>;
  /** When each absent player was first noticed missing, from the last call. */
  absentSince: Readonly<Record<string, number>>;
  now: number;
  /** What the room is doing. Nobody is reaped outside the lobby. */
  phase: Phase;
  graceMs?: number;
}

export interface ReapResult {
  /** Uids to delete from the room document. */
  remove: string[];
  /** The absence clock to carry into the next call. */
  absentSince: Record<string, number>;
}

/**
 * Decides who has genuinely left, given who the Realtime Database says is here.
 *
 * **An empty presence tree means presence is not working, not that the room is
 * deserted.** Reading it the other way is what made a blocked or unpublished
 * Realtime Database ruleset catastrophic rather than merely untidy: every
 * presence write failed, the quizmaster's reaper concluded that nobody was
 * there, and it deleted every player — including itself. An empty `players` map
 * makes `resolveQuizmaster` return null, so the role then flickered between
 * whoever rejoined next, and the room stopped responding to anybody's actions.
 *
 * Refusing to reap in that case costs nothing. Presence exists to tidy away
 * players who closed a tab; if it is unavailable, the worst outcome is a ghost
 * in the lobby, and the game stays playable. A room where genuinely nobody is
 * present has nobody watching it either.
 */
export function reapAbsent({
  players,
  present,
  absentSince,
  now,
  phase,
  graceMs = STALE_GRACE_MS,
}: ReapInput): ReapResult {
  const uids = Object.keys(players);

  // Only ever tidy the lobby.
  //
  // Reaping exists so a closed tab stops loitering in the list before a round
  // starts. Once one is running it is all cost and no benefit: a ghost in the
  // standings is harmless, whereas removing somebody who is still playing takes
  // their score off every screen — `standings` filters on membership — and
  // their result out of the season, because `recordGame` skips a uid that is
  // not in `players`. It happened in room 6SVG: 4,300 points, answered the
  // final question, no season row, invisible on every device.
  //
  // Presence is not evidence of leaving. It runs over the Realtime Database, a
  // different connection from the Firestore one carrying the game, so a
  // backgrounded tab or a closed lid drops it while the round plays on.
  //
  // The absence clock is dropped rather than carried, so coming back to the
  // lobby starts everyone fresh instead of reaping on a stale reading.
  if (phase !== 'lobby') {
    return { remove: [], absentSince: {} };
  }

  // Presence has nothing to say. Trust the room, not the silence.
  if (present.size === 0 && uids.length > 0) {
    return { remove: [], absentSince: {} };
  }

  const remove: string[] = [];
  const next: Record<string, number> = {};

  for (const uid of uids) {
    if (present.has(uid)) continue;

    const since = absentSince[uid] ?? now;
    if (now - since >= graceMs) remove.push(uid);
    else next[uid] = since;
  }

  return { remove, absentSince: next };
}
