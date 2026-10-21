/**
 * Turning what somebody typed into a lectern, on the answering device.
 *
 * The four options are already on the device. Matching against them reveals
 * nothing a player could not already read, and the vault, the reveal and the
 * rules only ever see an `optionIndex` — the same field a tap writes. What was
 * typed is not kept. See docs/decisions/typed-answers.md.
 *
 * Every shipped question has four options, so "no match" is index 4. The
 * answer rules already allow 0–9. An index past the lecterns scores as wrong.
 */

/** Past the four lecterns. Rules allow it; no option wears it. */
export const NO_MATCH_INDEX = 4;

/** An index that does not name a lectern. Shared by every unmatched call. */
export function isUnmatched(optionIndex: number): boolean {
  return optionIndex >= NO_MATCH_INDEX;
}

const LEADING_ARTICLE = /^(?:the|a|an)\s+/u;

/**
 * Case, accents, punctuation, `&` → `and`, a leading "the" / "a" / "an",
 * and spacing. The same function both sides, so the comparison cannot drift.
 */
function normalise(input: string): string {
  const lowered = input.toLocaleLowerCase('en-GB').replace(/&/g, ' and ');
  const plain = lowered.normalize('NFD').replace(/\p{M}/gu, '');
  const unquoted = plain.replace(/[''ʼ`´]/g, '');
  const spaced = unquoted.replace(/\p{P}/gu, ' ').replace(/\s+/g, ' ').trim();
  let rest = spaced;
  while (LEADING_ARTICLE.test(rest)) rest = rest.replace(LEADING_ARTICLE, '');
  return rest;
}

/**
 * How many edits a word of this length may absorb.
 *
 * One per five letters, and never more than two. A short option — Blankety
 * Blank's shape, or anything under five letters — allows none, so only an
 * exact normalised match can land on it.
 */
function typoBudget(letters: number): number {
  return Math.min(2, Math.floor(letters / 5));
}

/** Insertions, deletions and substitutions. A swapped pair counts as two. */
function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  let prev = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const curr = [i];
    const left = a.charCodeAt(i - 1);
    for (let j = 1; j <= b.length; j += 1) {
      const cost = left === b.charCodeAt(j - 1) ? 0 : 1;
      const del = (prev[j] ?? 0) + 1;
      const ins = (curr[j - 1] ?? 0) + 1;
      const sub = (prev[j - 1] ?? 0) + cost;
      curr[j] = Math.min(del, ins, sub);
    }
    prev = curr;
  }
  return prev[b.length] ?? a.length;
}

/**
 * The lectern a typed answer names, or {@link NO_MATCH_INDEX} when the
 * question has four options and nothing matched.
 *
 * 1. Exact, after {@link normalise}, and only when exactly one option is.
 * 2. Otherwise one edit per five letters of that option (at most two), and
 *    only when that option is strictly closer than the runner-up.
 * 3. Otherwise no match. One word of a longer phrase is not close enough:
 *    accepting it would reward a guess.
 *
 * `exactOnly` is Blankety Blank. Its wrong options are near-misses on
 * purpose, so a typo must not land.
 */
export function matchTypedAnswer(
  typed: string,
  options: readonly string[],
  exactOnly = false,
): number {
  const wanted = normalise(typed);
  if (wanted.length === 0) return options.length;

  const norms = options.map(normalise);
  const exact = norms.flatMap((norm, index) => (norm === wanted ? [index] : []));
  if (exact.length === 1) return exact[0] ?? options.length;
  if (exact.length > 1 || exactOnly) return options.length;

  let best = Infinity;
  let second = Infinity;
  let bestIndex = -1;
  for (let index = 0; index < norms.length; index += 1) {
    const distance = editDistance(wanted, norms[index] ?? '');
    if (distance < best) {
      second = best;
      best = distance;
      bestIndex = index;
    } else if (distance < second) {
      second = distance;
    }
  }

  const letters = [...(norms[bestIndex] ?? '')].length;
  if (bestIndex < 0 || best > typoBudget(letters) || best >= second) return options.length;
  return bestIndex;
}
