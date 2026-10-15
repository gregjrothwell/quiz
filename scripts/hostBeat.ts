/**
 * The host's heartbeat, as `useRoom` writes it (W3): `rooms/{code}/host/beat`
 * every 15 s for as long as this process holds the chair.
 *
 * A harness that makes a hosted room and does not beat loses it: after 75 s of
 * silence any browser in the room may claim the chair (`claim()` in
 * firestore.rules), and every host write after that is refused.
 * docs/decisions/host-authority.md.
 *
 * Imports nothing from `src/` beyond the engine, so it cannot reach
 * `src/firebase.ts` (`scripts/imports.test.ts`).
 */

import { doc, serverTimestamp, setDoc, type Firestore } from 'firebase/firestore';
import { BEAT_EVERY_MS } from '../src/engine/host';

/** Writes one beat now and one every 15 s; returns the stop. */
export async function startBeat(db: Firestore, code: string): Promise<() => void> {
  const beat = (): Promise<void> => setDoc(doc(db, 'rooms', code, 'host', 'beat'), { at: serverTimestamp() });
  await beat();
  const timer = setInterval(() => {
    beat().catch((cause: unknown) => console.error(`  the beat failed: ${String(cause)}`));
  }, BEAT_EVERY_MS);
  return () => clearInterval(timer);
}
