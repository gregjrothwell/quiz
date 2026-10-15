import { resolveQuizmaster, type Player } from './state';

/**
 * Host authority (W3): who runs the room, and how the chair changes hands.
 * docs/decisions/host-authority.md has the story and the twelve criteria.
 *
 * A room made since W3 names its host in `hostUid`, and the rules let only that
 * uid move the game on. A room made before it has no `hostUid` and keeps the
 * derived quizmaster, under the member rule it was made with, until it expires.
 */

/** How often the host writes `rooms/{code}/host/beat`. Greg, 15 October 2026. */
export const BEAT_EVERY_MS = 15_000;

/**
 * How old the beat must be before anybody may take the chair. **The rules hold
 * the same number** (`beatSilentMs()` in firestore.rules), and `host.test.ts`
 * fails if the two differ.
 *
 * 75 s and not 30 because a hidden tab's timers slow down. Chrome, after five
 * minutes hidden, runs chained timers — `setInterval` included — once a minute
 * ("intensive throttling", MDN `setTimeout`, last modified 3 Sep 2026), so a
 * throttled host's beats can be a minute apart. 75 leaves fifteen seconds over.
 */
export const CLAIM_AFTER_SILENT_MS = 75_000;

/**
 * How long the host must be missing from presence before the successor starts
 * asking for the chair. Below {@link CLAIM_AFTER_SILENT_MS}, because the last
 * beat was up to {@link BEAT_EVERY_MS} before the host vanished: asking from 50 s
 * every {@link CLAIM_RETRY_MS} lands the claim within a few seconds of the rules
 * allowing it, which is 60–75 s after a tab closes.
 */
export const CLAIM_AFTER_ABSENT_MS = 50_000;

/** Between claim attempts, each one a write the rules may refuse. */
export const CLAIM_RETRY_MS = 5_000;

/**
 * Who runs the room: `hostUid` where the room has one, and otherwise the
 * derived quizmaster, which is how every room before W3 was run.
 */
export function resolveHost(room: {
  hostUid: string | null;
  players: Record<string, Player>;
}): string | null {
  return room.hostUid ?? resolveQuizmaster(room.players);
}

/**
 * Who takes the chair when the host presses Leave: the longest-seated of the
 * people left, the one `resolveQuizmaster` would have picked. Null when nobody
 * is left, and then the chair stays where it was until somebody claims it.
 */
export function successorOnLeave(players: Record<string, Player>, leaving: string): string | null {
  const rest = { ...players };
  delete rest[leaving];
  return resolveQuizmaster(rest);
}

export interface ClaimInput {
  hostUid: string | null;
  players: Record<string, Player>;
  /** Uids under `presence/{code}` in the Realtime Database right now. */
  present: ReadonlySet<string>;
  /** When this device first saw the host missing, or null while it is present. */
  absentSince: number | null;
  now: number;
  /** This device. */
  uid: string;
}

export interface ClaimPlan {
  claim: boolean;
  absentSince: number | null;
}

/**
 * Whether this device should ask for the chair now.
 *
 * Only the longest-seated *present* player asks, so every device reaches the
 * same answer and at most one asks. Only once the host has been missing from
 * presence for {@link CLAIM_AFTER_ABSENT_MS}: a host who is merely slow — a
 * throttled tab still holds its connection — is never asked to give way. The
 * rules then check the beat, so a claim cannot succeed while the host is beating.
 *
 * An empty presence tree is presence not working, not a deserted room — the
 * same reading `reapAbsent` makes, for the same reason: acting on silence is how
 * a blocked ruleset once emptied a room.
 */
export function planClaim({ hostUid, players, present, absentSince, now, uid }: ClaimInput): ClaimPlan {
  if (hostUid === null || hostUid === uid) return { claim: false, absentSince: null };
  if (present.size === 0) return { claim: false, absentSince: null };
  if (present.has(hostUid)) return { claim: false, absentSince: null };

  const since = absentSince ?? now;
  if (now - since < CLAIM_AFTER_ABSENT_MS) return { claim: false, absentSince: since };

  const seated: Record<string, Player> = {};
  for (const [each, player] of Object.entries(players)) {
    if (each !== hostUid && present.has(each)) seated[each] = player;
  }
  return { claim: resolveQuizmaster(seated) === uid, absentSince: since };
}
