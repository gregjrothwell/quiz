import { doc, setDoc, type Firestore } from 'firebase/firestore';
import type { Verdict } from '../engine/questionVote';

/**
 * Where a player's opinion of a question goes.
 *
 * **A global collection, not a room subcollection**, and each of the three
 * reasons is specific to this project:
 *
 * - **It costs no reads.** Every client already holds an unfiltered
 *   `onSnapshot` on the room's answers, which is the `Q·N²` term in
 *   `docs/decisions/cost.md`. A second in-room collection would add another one
 *   — about 540 more reads a game at six players, 2,700 at twelve — to show a
 *   tally nobody asked for. This path is written and never read by a client.
 * - **It outlives the room.** `prune-rooms` deletes rooms and their
 *   subcollections; votes banked inside one would be deleted by the tool whose
 *   whole job is deleting rooms, which is a slow way to collect nothing.
 * - **It is deduplicated by construction.** The document id is the uid, so one
 *   person's opinion of a question counts once however many times they meet it.
 *   The consequence, stated rather than hidden: somebody voting from two
 *   browsers counts twice. Keying on `playerIdFor(uid)` instead would cost an
 *   `ownsPlayer` document read per vote to close a hole nobody is standing in.
 *
 * The document is **one field**. No option index, no room code, no timestamp —
 * the same discipline `ideas-review.md` §6 applies to the difficulty counters,
 * where a per-option breakdown would make the modal answer guessable and hand
 * back exactly what the vault protects. A verdict is written after the reveal
 * and says nothing whatever about the answer.
 *
 * **`Firestore` is a parameter for the reason `vault.ts` says it is**: nothing
 * here may reach `src/firebase.ts`, which reads `import.meta.env` in its module
 * body and so kills any script that imports it at any depth.
 */
function voteDoc(db: Firestore, questionId: string, uid: string) {
  return doc(db, 'questionVotes', questionId, 'votes', uid);
}

/**
 * Records what this player thought of a question.
 *
 * Overwrites a previous verdict on the same question rather than refusing one,
 * which matches the answering rule — a player may change their mind, and the
 * security rules allow `create, update` for exactly that reason.
 *
 * **Failures are swallowed on purpose.** A vote is a nicety collected during
 * the reveal, and the round is the thing that matters: an offline moment, a
 * ruleset not yet published, or App Check having a bad day must not put an
 * error notice over the top of everybody's standings. The caller shows the vote
 * as taken because the tap happened, not because the write landed — the same
 * choice `handleAnswer` makes about the lock sound.
 */
export async function recordVote(
  db: Firestore,
  questionId: string,
  uid: string,
  verdict: Verdict,
): Promise<void> {
  try {
    await setDoc(voteDoc(db, questionId, uid), { verdict });
  } catch {
    // Deliberately silent. See above.
  }
}
