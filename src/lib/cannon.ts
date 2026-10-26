import { doc, getDoc, serverTimestamp, setDoc, type Firestore } from 'firebase/firestore/lite';
import {
  SHOTS,
  TEST_SHOT,
  readKillSwitch,
  verdictId,
  type CannonVerdict,
  type KillSwitch,
  type Shot,
} from '../engine/cannon';
import { emulatorsWanted } from './emulators';

/**
 * The Slop Cannon's two trips to Firestore (docs/decisions/slop-cannon.md):
 * the kill switch, read once per page load, and a player's Keep / Bin.
 *
 * Over Firestore Lite for the beacon's reason — a refusal costs its own request
 * and never the round's write stream. `Firestore` is a parameter so nothing
 * here reaches `src/firebase.ts`.
 */

/**
 * `config/cannon`, read. A missing document is nothing pulled; a failed read
 * is everything pulled (C3) — a switch that cannot be read must not leave a
 * shot running that somebody turned off.
 */
export async function readCannonKillSwitch(db: Firestore): Promise<KillSwitch> {
  try {
    const snapshot = await getDoc(doc(db, 'config', 'cannon'));
    return readKillSwitch(snapshot.exists() ? snapshot.data() : undefined);
  } catch {
    // Deliberately not reported: C3 is the handling. Every shot reads as off.
    return 'all';
  }
}

export function verdictRef(db: Firestore, gameId: string, shot: string, uid: string) {
  return doc(db, 'cannonVerdicts', verdictId(gameId, shot, uid));
}

/** Files one Keep / Bin. Throws on refusal, for the rules cases; the app uses {@link recordCannonVerdict}. */
export async function writeCannonVerdict(
  db: Firestore,
  gameId: string,
  shot: string,
  uid: string,
  verdict: CannonVerdict,
): Promise<void> {
  await setDoc(verdictRef(db, gameId, shot, uid), { gameId, shot, verdict, uid, at: serverTimestamp() });
}

/**
 * Files it and swallows a failure, as `recordVote` does: the podium is the
 * moment, and a verdict that did not land must not put a notice over it.
 */
export async function recordCannonVerdict(
  db: Firestore,
  gameId: string,
  shot: string,
  uid: string,
  verdict: CannonVerdict,
): Promise<void> {
  try {
    await writeCannonVerdict(db, gameId, shot, uid, verdict);
  } catch {
    // Deliberately silent. See above.
  }
}

/**
 * What this build can fire: the registry, plus the test shot under the
 * emulators only (B6), so e2e can drive the path while the live cannon is empty.
 */
export function registeredShots(): readonly Shot[] {
  return emulatorsWanted() ? [...SHOTS, TEST_SHOT] : SHOTS;
}
