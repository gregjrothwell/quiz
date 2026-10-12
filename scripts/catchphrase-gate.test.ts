import { describe, expect, test } from 'vitest';
import { CATCHPHRASE_PICTURE_TEXT } from './catchphrase-picture-text';
import { CATCHPHRASE_SPECS, namesTheAnswer, type CatchphraseSpec } from './hand-catchphrase-data';

/**
 * No shipped Catchphrase drawing prints its own answer.
 *
 * The rule the sleeves taught (docs/decisions/sleeves-gate.md), held offline:
 * `write-catchphrase-pack` records what Vision read off every drawing it
 * shipped, and this refuses the pack if any of it names the answer. The
 * matcher's own deny cases are in `hand-catchphrase-data.test.ts`, which is
 * what stops this passing by matching nothing.
 *
 * Vision under-reads stylised lettering, so a clean read is the weaker verdict.
 * The stronger defence is upstream: no prompt says its phrase.
 *
 * **A new batch waits for its pictures on the end of the list**, with no
 * `seed`, until `draw-overnight` has drawn it and somebody has picked. Until
 * 9 October 2026 this file asked every spec for a seed, so a batch written
 * before it was drawn turned `npm test` red (the third batch's restore point,
 * `ad5d784`). Now only the end of the list may wait, and the pack writer still
 * refuses to run while anything does — so nothing unpicked can ship.
 *
 * The waiting tail is any length, so more than one batch can wait: from
 * 9 October 2026 the fourth (drawn, not picked) and the fifth (not drawn) both
 * did. Unchanged by that; a hole before a picked spec still fails.
 *
 * **A dropped spec is decided, not waiting** (12 October 2026): looked at and
 * kept out, so it is no hole wherever it sits, and it never has a seed.
 */

/** Slugs with no picked drawing that come before one that has one: a hole, not a waiting batch. */
function holesBeforeTheTail(specs: readonly CatchphraseSpec[]): string[] {
  const lastPicked = specs.reduce((last, spec, i) => (spec.seed === undefined ? last : i), -1);
  return specs
    .slice(0, lastPicked + 1)
    .filter((spec) => spec.seed === undefined && spec.dropped === undefined)
    .map((spec) => spec.slug);
}

describe('the shipped catchphrase drawings', () => {
  const picked = CATCHPHRASE_SPECS.filter((spec) => spec.seed !== undefined);

  test('every picked spec shipped a drawing that was read, and nothing else did', () => {
    const shipped = Object.keys(CATCHPHRASE_PICTURE_TEXT).sort();
    expect(shipped).toEqual(picked.map((spec) => spec.slug).sort());
  });

  test('none of them prints its own answer', () => {
    const printing = CATCHPHRASE_SPECS.filter((spec) =>
      namesTheAnswer(CATCHPHRASE_PICTURE_TEXT[spec.slug] ?? '', spec.correct),
    );
    expect(printing.map((spec) => spec.slug)).toEqual([]);
  });

  test('only the newest puzzles wait for a pick; everything before them says which drawing it shipped', () => {
    expect(holesBeforeTheTail(CATCHPHRASE_SPECS)).toEqual([]);
  });

  test('nothing is both dropped and picked', () => {
    const both = CATCHPHRASE_SPECS.filter((spec) => spec.dropped !== undefined && spec.seed !== undefined);
    expect(both.map((spec) => spec.slug)).toEqual([]);
  });
});

describe('the waiting-batch check', () => {
  const spec = (slug: string, seed?: number, dropped?: CatchphraseSpec['dropped']): CatchphraseSpec => ({
    slug,
    correct: 'Invented',
    incorrect: ['One', 'Two', 'Three'],
    difficulty: 'medium',
    scene: 'A hill.',
    ...(seed === undefined ? {} : { seed }),
    ...(dropped === undefined ? {} : { dropped }),
  });

  test('refuses a puzzle that lost its pick with picked ones after it', () => {
    expect(holesBeforeTheTail([spec('a', 1), spec('b'), spec('c', 2)])).toEqual(['b']);
    expect(holesBeforeTheTail([spec('a'), spec('b', 3)])).toEqual(['a']);
  });

  test('allows a batch waiting on the end, and a pack with none waiting', () => {
    expect(holesBeforeTheTail([spec('a', 1), spec('b', 2), spec('c'), spec('d')])).toEqual([]);
    expect(holesBeforeTheTail([spec('a', 1), spec('b', 2)])).toEqual([]);
  });

  test('allows a dropped puzzle mid-list, and still refuses a real hole beside it', () => {
    expect(holesBeforeTheTail([spec('a', 1), spec('b', undefined, 'spoiled'), spec('c', 2)])).toEqual([]);
    expect(holesBeforeTheTail([spec('a', undefined, 'misdrawn'), spec('b'), spec('c', 3)])).toEqual(['b']);
  });
});
