import { doc, serverTimestamp, setDoc, type Firestore } from 'firebase/firestore/lite';
import type { Q1TraceDoc } from '../engine/q1Trace';

/**
 * Where a device's question-one trace goes. See `src/engine/q1Trace.ts` for what
 * it holds and docs/decisions/cass-q1.md for why it exists.
 *
 * **Over Firestore Lite**, the vault's and the beat's reason: Lite sends each
 * write as its own request, so a refusal — the rules not yet published, a bad
 * moment for App Check — costs that request and nothing else. On the main SDK
 * it would close the write stream the next answer is about to use, and a
 * diagnostic that costs somebody question two is worse than none.
 *
 * `Firestore` is a parameter so nothing here reaches `src/firebase.ts`, the
 * same rule `questionVotes.ts` keeps.
 */
export function traceRef(db: Firestore, gameId: string, uid: string) {
  return doc(db, 'q1Traces', `${gameId}_${uid}`);
}

/** Files the trace. Throws on refusal, for the rules cases; the app calls {@link recordQ1Trace}. */
export async function writeQ1Trace(db: Firestore, trace: Q1TraceDoc): Promise<void> {
  await setDoc(traceRef(db, trace.gameId, trace.uid), { ...trace, at: serverTimestamp() });
}

/**
 * Files the trace and swallows any failure, as `recordVote` does: it is
 * evidence for later, and must never put a notice over the round.
 */
export async function recordQ1Trace(db: Firestore, trace: Q1TraceDoc): Promise<void> {
  try {
    await writeQ1Trace(db, trace);
  } catch {
    // Deliberately silent. See above.
  }
}

/**
 * `navigator.connection.effectiveType` where the browser offers it — Chrome and
 * Android do, Safari does not — and null otherwise. Read defensively because
 * the DOM types do not declare it everywhere.
 */
export function networkType(): string | null {
  if (typeof navigator === 'undefined') return null;
  const connection: unknown = Reflect.get(navigator, 'connection');
  if (typeof connection !== 'object' || connection === null) return null;
  const effective: unknown = Reflect.get(connection, 'effectiveType');
  return typeof effective === 'string' ? effective : null;
}

/** A Firestore error's code, for the trace — `permission-denied` is the one that matters. */
export function refusalCode(cause: unknown): string {
  if (typeof cause === 'object' && cause !== null) {
    const code: unknown = Reflect.get(cause, 'code');
    if (typeof code === 'string') return code;
  }
  return 'unknown';
}
