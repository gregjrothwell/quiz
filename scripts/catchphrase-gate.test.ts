import { describe, expect, test } from 'vitest';
import { CATCHPHRASE_PICTURE_TEXT } from './catchphrase-picture-text';
import { CATCHPHRASE_SPECS, namesTheAnswer } from './hand-catchphrase-data';

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
 */
describe('the shipped catchphrase drawings', () => {
  test('every spec shipped a drawing that was read', () => {
    const shipped = Object.keys(CATCHPHRASE_PICTURE_TEXT).sort();
    expect(shipped).toEqual(CATCHPHRASE_SPECS.map((spec) => spec.slug).sort());
  });

  test('none of them prints its own answer', () => {
    const printing = CATCHPHRASE_SPECS.filter((spec) =>
      namesTheAnswer(CATCHPHRASE_PICTURE_TEXT[spec.slug] ?? '', spec.correct),
    );
    expect(printing.map((spec) => spec.slug)).toEqual([]);
  });

  test('every spec says which drawing it shipped', () => {
    expect(CATCHPHRASE_SPECS.filter((spec) => spec.seed === undefined).map((spec) => spec.slug)).toEqual([]);
  });
});
