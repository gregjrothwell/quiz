import { doc, getDoc, setDoc, type Firestore } from 'firebase/firestore';
import type { QuizQuestion } from '../engine/state';

/**
 * How the answer gets out of the vault.
 *
 * The packs ship without answers and the vault collection is unreadable by
 * every client — `allow read: if false`, which security rules themselves can
 * still see through, because `get()` inside a rule is not subject to the rules
 * on the document it reads. So no device can look the answer up. What it can do
 * is *assert* one and have the rules judge it:
 *
 *   create /rooms/{code}/reveal/{questionId} = { answer: "Metropolitan Line" }
 *
 * and the rule allows the write only if that string matches the vault. Trying
 * all four options therefore finds the answer in at most four attempts — which
 * would be a fine way to cheat, except the same rule refuses the write until the
 * room's own answer window has elapsed on the server's clock. Nobody can ask
 * before the window has closed, in this room or in one of their own, and the
 * question id does not exist anywhere until the question opens.
 *
 * There is deliberately no gate constant here. The window is `durationSecs` on
 * the room document, and the rules read it from there — a copy in this file
 * could only ever drift out of agreement with the thing actually enforcing it.
 *
 * See docs/decisions/vault.md for what this does and does not buy.
 *
 * **Nothing here reaches `src/firebase.ts`, and that is load-bearing.** The
 * Firestore instance is a parameter, so this module runs anywhere — including
 * from Node, which `scripts/host-room.ts` needs. It used to carry a one-line
 * convenience wrapper that closed over the app's singleton, and the import at
 * the top of the file was enough to break every script that touched this
 * module: `src/firebase.ts` reads `import.meta.env` in its module body, which
 * exists under Vite and nowhere else. `host-room` died on that import for
 * weeks, and the cost was not one broken command but three untested paths that
 * had no other tool. `scripts/imports.test.ts` now fails if it comes back.
 */

function revealDoc(db: Firestore, code: string, questionId: string) {
  return doc(db, 'rooms', code, 'reveal', questionId);
}

function isPermissionDenied(cause: unknown): boolean {
  return (
    typeof cause === 'object' &&
    cause !== null &&
    'code' in cause &&
    String((cause as { code: unknown }).code) === 'permission-denied'
  );
}

/**
 * Finds which option the vault says is correct, and leaves the proof behind at
 * `rooms/{code}/reveal/{questionId}` for anyone who wants to check.
 *
 * All four candidates go at once. Three will be refused and one accepted, so
 * the reveal costs one round trip rather than up to four — the difference
 * between an imperceptible pause and most of a second with the whole room
 * watching.
 *
 * A reveal that has already been recorded — because the quizmaster's tab
 * reloaded, or the role changed hands mid-question — is read back rather than
 * rewritten, since the rules make these documents immutable once created.
 */
export async function resolveAnswer(
  db: Firestore,
  code: string,
  question: QuizQuestion,
): Promise<number> {
  const attempts = question.options.map(async (option, index) => {
    try {
      await setDoc(revealDoc(db, code, question.id), { answer: option });
      return index;
    } catch (cause) {
      // A refusal is the expected outcome for three of the four, and carries no
      // information beyond "not this one". Anything else — offline, a missing
      // ruleset — has to surface, or a reveal that cannot happen looks
      // identical to a question nobody got right.
      if (isPermissionDenied(cause)) return -1;
      throw cause;
    }
  });

  const results = await Promise.all(attempts);
  const found = results.find((index) => index >= 0);
  if (found !== undefined) return found;

  // Every candidate refused. Either the gate has not opened yet, or this
  // question was already revealed once — a reloaded tab, or the role changing
  // hands mid-question — and these documents are immutable once written, so a
  // second attempt at the right answer is refused exactly like a wrong one.
  // Reading it back is the only way to tell those two apart.
  const existing = await getDoc(revealDoc(db, code, question.id));
  if (existing.exists()) {
    const { answer } = existing.data() as { answer?: unknown };
    const index = question.options.indexOf(String(answer));
    if (index >= 0) return index;
  }

  throw new Error(
    'The vault would not confirm an answer for this question. It only opens once '
      + 'the clock has run out — give it a moment and try again.',
  );
}
