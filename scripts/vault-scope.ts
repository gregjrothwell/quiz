/**
 * Narrows a vault seed to the packs named with `--pack`.
 *
 * Pure, and apart from `seed-vault.ts`, because that script calls `main()` at
 * import and reaches the Admin SDK — nothing in it can be tested offline.
 *
 * **Why it exists: the full seed reads the whole vault to find what is new.**
 * 14,266 answers on 26 September 2026, which is 29% of the Spark plan's 50,000
 * reads a day, spent from the same pool the office plays on — and `cost.md`
 * records a seed taking the game down for a day. A picture top-up changes one
 * pack, so it should read one pack: about 200 reads rather than 14,000.
 */

export interface PackIds {
  readonly id: string;
  readonly questions: readonly { readonly id: string }[];
}

export interface Scoped {
  /** Only the answers for questions in the named packs. */
  readonly answers: Record<string, string>;
  /**
   * Questions in the named packs with no answer in the local cache. Seeding
   * cannot fix these — the harvest never wrote them — and each one stalls its
   * round at the reveal, so the script refuses rather than half-seeding.
   */
  readonly missing: readonly string[];
}

/** Every value given as `--pack a,b` or `--pack a --pack b`, in order, deduplicated. */
export function packArgs(argv: readonly string[]): string[] {
  const named = argv.flatMap((arg, index) =>
    argv[index - 1] === '--pack' ? arg.split(',').map((id) => id.trim()) : [],
  );
  return [...new Set(named.filter((id) => id.length > 0))];
}

export function scopeToPacks(
  answers: Readonly<Record<string, string>>,
  packs: readonly PackIds[],
): Scoped {
  const scoped: Record<string, string> = {};
  const missing: string[] = [];

  for (const pack of packs) {
    for (const { id } of pack.questions) {
      const answer = answers[id];
      if (answer === undefined) missing.push(id);
      else scoped[id] = answer;
    }
  }

  return { answers: scoped, missing };
}
