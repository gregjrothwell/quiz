/**
 * What a season has already served, and the rules for adding to it.
 *
 * Pure, and in the engine rather than beside the Firestore calls in
 * `src/lib/season.ts`, because the decision that matters here is arithmetic and
 * `season.ts` reaches `src/firebase.ts` — which `npm test` cannot load. The
 * merge and the cap used to live inline in `recordAsked`, where nothing could
 * reach them; the defect below shipped for that reason.
 */

/**
 * How many question ids to remember per pack.
 *
 * Deliberately not "all of them". The point is to stop last month's questions
 * coming round again, not to guarantee a pack is exhausted before anything
 * repeats — and a list that grows without limit eventually costs more to carry
 * than the repetition costs to sit through.
 *
 * **Raised from 400 to 500 on 2 September 2026, on a measurement**:
 * `asked-probe` found General Knowledge sitting at exactly 400, the old cap, so
 * the pack the office plays most had begun forgetting its oldest questions and
 * serving them again. `firestore.rules` bounds this list at 600, so 500 is the
 * most that can be taken without a ruleset paste while still leaving the
 * headroom that bound exists for — a client one deploy ahead of the published
 * rules must not be locked out of writing its history. **Going past 500 is a
 * paste, not a constant.**
 */
export const ASKED_LIMIT = 500;

/**
 * What the round knows about the questions this season has already served.
 *
 * `known` is the whole point of the type. A read that was refused and a season
 * that has genuinely served nothing both produce an empty set, and telling them
 * apart is the difference between preserving a history and destroying it.
 */
export interface AskedHistory {
  readonly ids: ReadonlySet<string>;
  /** False when the read failed or was refused, so the set means nothing. */
  readonly known: boolean;
}

/** A history that could not be read. The round plays on; it just cannot record. */
export const NO_HISTORY: AskedHistory = { ids: new Set(), known: false };

/** A history that was read, whether or not it turned out to hold anything. */
export function seenHistory(ids: ReadonlySet<string>): AskedHistory {
  return { ids, known: true };
}

/**
 * This round's ids in front of the ones already held, capped newest-first.
 *
 * Ordering newest-first means the cap drops the questions nobody remembers
 * anyway. Written whole rather than appended with `arrayUnion` because the cap
 * has to be applied somewhere and `arrayUnion` has no notion of oldest.
 */
export function mergeAsked(
  ids: readonly string[],
  previous: ReadonlySet<string>,
  limit: number = ASKED_LIMIT,
): string[] {
  const merged = [...ids, ...[...previous].filter((id) => !ids.includes(id))];
  return merged.slice(0, limit);
}

/**
 * The ids to write back, or `null` for "write nothing".
 *
 * **This is the guard, and it is here rather than at the call site because the
 * call site is where it was missed.** `recordAsked` replaces the whole document,
 * so writing a history assembled from a read that failed does not merely lose
 * this round's contribution — it overwrites up to {@link ASKED_LIMIT} remembered
 * ids with the fifteen from this round, permanently, and every round afterwards
 * draws from the full pack again. The round itself is unaffected either way, and
 * nothing on screen says a word, which is why this ran for weeks.
 *
 * Not writing costs one round's worth of memory. Writing costs all of it.
 */
export function askedToWrite(
  ids: readonly string[],
  history: AskedHistory,
  limit: number = ASKED_LIMIT,
): string[] | null {
  if (!history.known) return null;
  return mergeAsked(ids, history.ids, limit);
}
