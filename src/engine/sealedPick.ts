import { isStandoffPick, type StandoffPick } from './standoff';

/**
 * Keeping a pick secret until both are in, with no server.
 *
 * Every client can read every document in a room — `firestore.rules` accepts
 * that on purpose for answers, where seeing somebody's stake early is harmless.
 * Seeing a pick early is the whole game: whoever picks second would simply read
 * the first. So a finalist's device commits first and reveals afterwards.
 *
 * 1. Tapping writes `sha256(pick, nonce, gameId, uid)` and nothing else.
 * 2. Once both commitments are in, each finalist's device writes its pick and
 *    nonce, and every client checks them against the commitment.
 *
 * The nonce is 128 random bits, so a two-word choice cannot be guessed from its
 * hash. The uid and the game are inside the hash, so a commitment cannot be
 * copied from the other finalist and mirrored, or carried over from a round
 * played earlier in the same room. A reveal that does not match is no pick —
 * which counts as share, and so can only ever help the other finalist.
 *
 * The rules only bound the fields (`firestore.rules`, `match /standoff/{uid}`).
 * Everything that decides whether a pick counts is here, where `npm test`
 * reaches it. See docs/decisions/share-or-shaft.md.
 */

export interface SealedPickDoc {
  gameId: string;
  commit: string;
  pick?: string;
  nonce?: string;
}

const encoder = new TextEncoder();

function hex(bytes: ArrayBuffer | Uint8Array): string {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function freshNonce(): string {
  return hex(crypto.getRandomValues(new Uint8Array(16)));
}

export async function commitmentFor(
  pick: StandoffPick,
  nonce: string,
  gameId: string,
  uid: string,
): Promise<string> {
  // Newline-separated: none of the four can contain one — the pick is one of two
  // words, the nonce is hex, the game id a UUID and the uid Firebase's own.
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode([pick, nonce, gameId, uid].join('\n')));
  return hex(digest);
}

/** What a finalist writes on tapping. A commitment only — no pick in any form. */
export async function commitmentDoc(
  pick: StandoffPick,
  nonce: string,
  gameId: string,
  uid: string,
): Promise<{ gameId: string; commit: string }> {
  return { gameId, commit: await commitmentFor(pick, nonce, gameId, uid) };
}

/** What a finalist adds once both commitments are in. */
export function revealDoc(pick: StandoffPick, nonce: string): { pick: StandoffPick; nonce: string } {
  return { pick, nonce };
}

/** Whether this document is a commitment to the round being played. */
export function hasCommitted(doc: SealedPickDoc | undefined, gameId: string): boolean {
  return doc !== undefined && doc.gameId === gameId && /^[0-9a-f]{64}$/.test(doc.commit);
}

/**
 * The pick a document proves, or null. Null for no document, a commitment to
 * another round, a commitment not yet revealed, a word that is neither pick,
 * and anything that does not hash to what was committed.
 */
export async function openedPick(
  doc: SealedPickDoc | undefined,
  gameId: string,
  uid: string,
): Promise<StandoffPick | null> {
  if (!doc || doc.gameId !== gameId) return null;
  if (!isStandoffPick(doc.pick) || typeof doc.nonce !== 'string') return null;
  const expected = await commitmentFor(doc.pick, doc.nonce, gameId, uid);
  return expected === doc.commit ? doc.pick : null;
}

/**
 * A document off the wire, field by field, so a stray key never reaches the
 * engine and a malformed one is no pick at all rather than a crash.
 */
export function sealedPickDocFrom(data: unknown): SealedPickDoc | null {
  if (typeof data !== 'object' || data === null) return null;
  const record = data as Record<string, unknown>;
  const { gameId, commit, pick, nonce } = record;
  if (typeof gameId !== 'string' || typeof commit !== 'string') return null;
  return {
    gameId,
    commit,
    ...(typeof pick === 'string' ? { pick } : {}),
    ...(typeof nonce === 'string' ? { nonce } : {}),
  };
}
