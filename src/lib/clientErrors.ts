import { addDoc, collection, serverTimestamp, type Firestore } from 'firebase/firestore/lite';
import {
  buildFrom,
  createBeaconBudget,
  errorDoc,
  type ClientErrorDoc,
  type ErrorContext,
  type ErrorSource,
} from '../engine/clientError';
import { deviceFrom } from '../engine/q1Trace';

/**
 * Where the error beacon writes (docs/decisions/slop-cannon.md, A). The shape
 * and the budget are `src/engine/clientError.ts`.
 *
 * **Over Firestore Lite**, the question-one trace's reason: a refusal costs its
 * own request and nothing else, where on the main SDK it would close the write
 * stream the round is using. A beacon that breaks the round it is reporting on
 * is worse than none.
 *
 * `Firestore` is a parameter so nothing here reaches `src/firebase.ts`.
 */

/** Files one row. Throws on refusal, for the rules cases; the app uses {@link createBeacon}. */
export async function writeClientError(db: Firestore, doc: ClientErrorDoc): Promise<void> {
  await addDoc(collection(db, 'clientErrors'), { ...doc, at: serverTimestamp() });
}

export type Beacon = (message: string, source: ErrorSource, context: ErrorContext, step: string) => void;

/**
 * One per page. `db` is a function so Firestore is not touched until there is
 * something to say — a healthy page never opens Lite for this.
 */
export function createBeacon(db: () => Firestore): Beacon {
  const budget = createBeaconBudget();
  const build = typeof document === 'undefined'
    ? 'dev'
    : buildFrom([...document.querySelectorAll('script[src]')].map((script) => script.getAttribute('src') ?? ''));
  const device = deviceFrom(typeof navigator === 'undefined' ? '' : navigator.userAgent);

  return (message, source, context, step) => {
    if (!message || !budget(message, step)) return;
    void (async () => {
      try {
        await writeClientError(db(), errorDoc(message, source, context, build, device));
      } catch {
        // Deliberately silent (A6): a beacon that fails must never raise a
        // notice of its own, or it reports itself in a loop.
      }
    })();
  };
}
