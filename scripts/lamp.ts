/**
 * A seat's answer lamp, as `submitAnswer` lights it beside the answer (W3).
 *
 * Since W3 a player may not read anybody else's answer before the reveal, so a
 * browser counts "N of M answered" from `lamps/{code}/{gameId}:{index}/{uid}`
 * in the Realtime Database. A harness seat that answers without lighting one
 * is invisible there: on 15 October a browser in a `rank-harness` room saw
 * "1 of 9 answered", its own. docs/decisions/host-authority.md.
 *
 * `database.rules.json` lets a uid light only its own lamp, and only `true`.
 *
 * Imports nothing from `src/` that reaches `src/firebase.ts`
 * (`scripts/imports.test.ts`).
 */

import type { FirebaseApp } from 'firebase/app';
import { getDatabase, ref, set } from 'firebase/database';
import { lampKey } from '../src/lib/roomDoc';

/**
 * Lights `uid`'s lamp for question `index` of game `gameId`. Awaited, where the
 * app's is best-effort: a harness whose lamps fail to light proves nothing
 * about what a browser in its room sees, so it should say so.
 */
export function lightLamp(
  app: FirebaseApp,
  code: string,
  gameId: string | null,
  index: number,
  uid: string,
): Promise<void> {
  return set(ref(getDatabase(app), `lamps/${code}/${lampKey(gameId, index)}/${uid}`), true);
}
