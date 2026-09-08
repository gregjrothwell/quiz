import { doc, serverTimestamp, setDoc, type Firestore } from 'firebase/firestore';
import type { GameRecord } from '../engine/gameRecord';

/**
 * Where a finished round goes: `games/{gameId}`, a global collection that is
 * written once and never read by a client.
 *
 * **Global, not `rooms/{code}/games`**, for the reasons `questionVotes.ts`
 * gives and one more. Every client holds an unfiltered listener on the room's
 * subcollections, so an in-room copy would be re-read by every device — a
 * second `Q·N²` term in `docs/decisions/cost.md` for data nobody in the room
 * needs. It also has to outlive the room: `prune-rooms` deletes rooms and
 * their subcollections, and a record banked inside one would be swept by the
 * tool whose whole job is sweeping rooms. The third reason is the id: a round's
 * `gameId` is minted fresh each time one starts, so the document id is the
 * deduplication, and "Another round" in the same room cannot overwrite the last.
 *
 * `read-games` reads it back with the Admin SDK, which the rules do not bind —
 * the same asymmetry the vault and the votes rely on.
 *
 * **`Firestore` is a parameter for the reason `vault.ts` says it is**: nothing
 * here may reach `src/firebase.ts`, which reads `import.meta.env` in its module
 * body and so kills any script that imports it at any depth.
 */
function gameDoc(db: Firestore, gameId: string) {
  return doc(db, 'games', gameId);
}

/**
 * What became of the write, so the caller can decide whether trying again is
 * worth anything.
 *
 * - `kept` — it landed.
 * - `refused` — the rules said no. Either the ruleset has not been pasted, or a
 *   record with this id already exists and `update` is refused by design.
 *   Neither changes on a retry, so the caller should stop.
 * - `failed` — offline, a timeout, anything else. The next attempt may land.
 */
export type KeepOutcome = 'kept' | 'refused' | 'failed';

function isPermissionDenied(cause: unknown): boolean {
  return (
    typeof cause === 'object'
    && cause !== null
    && 'code' in cause
    && String((cause as { code: unknown }).code) === 'permission-denied'
  );
}

/**
 * Keeps a finished round.
 *
 * **Never rejects, and never tells the player anything.** This is a record for
 * later, not part of the round: a ruleset that has not been pasted yet, or an
 * offline moment on the final screen, must not put an error notice over the top
 * of everybody's standings. The caller learns what happened from the outcome,
 * and `npm run check-rules` is what says whether the paste has landed — the
 * allow case there is the only thing that proves it.
 *
 * `finishedAt` is the server's clock rather than the device's, so the rules can
 * pin it (`== request.time`) and so a laptop with the wrong date cannot file a
 * round under the wrong week.
 */
export async function keepGameRecord(
  db: Firestore,
  gameId: string,
  record: GameRecord,
): Promise<KeepOutcome> {
  try {
    await setDoc(gameDoc(db, gameId), { ...record, finishedAt: serverTimestamp() });
    return 'kept';
  } catch (cause) {
    return isPermissionDenied(cause) ? 'refused' : 'failed';
  }
}
