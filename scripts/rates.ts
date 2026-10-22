/**
 * The office's hit rates, folded out of kept rounds (`games/`), for Beat the
 * Chaser (docs/decisions/beat-the-chaser.md, S1–S3). Pure: `fold-rates.ts`
 * fetches and writes, this does the arithmetic and is covered by `npm test`.
 *
 * Imports nothing that reaches `src/firebase.ts` (`scripts/imports.test.ts`).
 */

import type { Rates, Tally } from '../src/engine/chaser';
import type { GameRecord } from '../src/engine/gameRecord';

/** Rounds the harnesses and tests write, by the id prefix each one uses. */
export const HARNESS_GAME = /^(host|final|rank|node|harness|probe|sync)-/;

function add(tally: Tally | undefined, hits: number, tries: number): Tally {
  return { hits: (tally?.hits ?? 0) + hits, tries: (tally?.tries ?? 0) + tries };
}

/**
 * Folds rounds into rates. A random round's pack is `random`, so each of its
 * questions is credited to the pack it came from, found by id in `packOf`; a
 * question whose pack cannot be found is still counted in its difficulty and
 * overall. Skipped questions and Survey Says are left out: one has no answers to
 * count, the other has no right one.
 */
export function foldRates(
  games: readonly { id: string; record: GameRecord }[],
  packOf: ReadonlyMap<string, string>,
): Rates {
  const rates: Rates = { overall: { hits: 0, tries: 0 }, byDifficulty: {}, byPack: {} };
  for (const { id, record } of games) {
    if (HARNESS_GAME.test(id)) continue;
    for (const question of record.questions) {
      if (question.skipped || question.survey || question.correctIndex === null) continue;
      const given = Object.values(question.answers);
      if (given.length === 0) continue;
      const hits = given.filter((answer) => answer.optionIndex === question.correctIndex).length;
      const tries = given.length;
      const pack = record.packId === 'random' ? packOf.get(question.id) : record.packId;

      rates.overall = add(rates.overall, hits, tries);
      rates.byDifficulty[question.difficulty] = add(rates.byDifficulty[question.difficulty], hits, tries);
      if (pack) {
        const byDifficulty = (rates.byPack[pack] ??= {});
        byDifficulty[question.difficulty] = add(byDifficulty[question.difficulty], hits, tries);
      }
    }
  }
  return sorted(rates);
}

/** Keys in order, so an unchanged history writes an identical file (S3). */
function sorted(rates: Rates): Rates {
  const byKey = <T>(record: Record<string, T>): Record<string, T> =>
    Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b)));
  return {
    overall: rates.overall,
    byDifficulty: byKey(rates.byDifficulty),
    byPack: byKey(Object.fromEntries(Object.entries(rates.byPack).map(([pack, tallies]) => [pack, byKey(tallies)]))),
  };
}
