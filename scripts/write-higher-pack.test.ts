import { describe, expect, test } from 'vitest';
import { HIGHER_MIN_PACK, HIGHER_MIN_PER_LEVEL, HIGHER_MONTH, type HigherSpec } from './hand-higher-data';
import { buildHigherPack } from './write-higher-pack';
import type { Observed } from './write-prices-pack';
import { stableId } from './write-hand-packs';
import { DIFFICULTIES } from '../src/questions/types';

/*
  The builder on invented items and invented prices: Greg plays this round
  blind, so nothing in this file, or in a failure from it, is a real price.
  Real ones live only in `.cache/prices/observed.json`.
*/

/** How the hidden item's price compares with the shown one's: each level both ways. */
const FACTORS = [2.5, 1 / 2.5, 1.5, 1 / 1.5, 1.2, 1 / 1.2];
const SHOWN_POUNDS = [0.6, 2, 7.5, 30];

function specsOf(n: number): HigherSpec[] {
  return Array.from({ length: n }, (_, i) => {
    const at = String(i + 1).padStart(3, '0');
    return {
      slug: `higher-${at}`,
      shown: { key: `900${at}`, name: `a made-up thing ${at}` },
      hidden: { key: `910${at}`, name: `another made-up thing ${at}` },
    };
  });
}

/** Shown and hidden prices for every spec, with `factors` setting the hidden one. */
function invented(specs: readonly HigherSpec[], factors = FACTORS, quotes = 40): Observed {
  const month: Record<string, { desc: string; median: number; n: number }> = {};
  specs.forEach((spec, i) => {
    const shown = SHOWN_POUNDS[i % SHOWN_POUNDS.length] as number;
    month[spec.shown.key] = { desc: `ITEM ${spec.shown.key}`, median: shown, n: 40 };
    month[spec.hidden.key] = {
      desc: `ITEM ${spec.hidden.key}`,
      median: shown * (factors[i % factors.length] as number),
      n: quotes,
    };
  });
  return { quotes: { [HIGHER_MONTH]: month }, rpi: {} };
}

describe('buildHigherPack', () => {
  const specs = specsOf(HIGHER_MIN_PACK);
  const { pack, answers } = buildHigherPack(invented(specs), specs);

  test('one question per spec, in order, under the stable id', () => {
    expect(pack.id).toBe('higher');
    expect(pack.questions.map((question) => question.id)).toEqual(specs.map((spec) => stableId(spec.slug)));
  });

  test('two options, Higher then Lower, in that order, and the answer is one of them', () => {
    for (const question of pack.questions) {
      expect(question.options).toHaveLength(2);
      expect(question.options[0]).toMatch(/^Higher, /);
      expect(question.options[1]).toMatch(/^Lower, /);
      expect(question.ordered).toBe(true);
      expect(question.options).toContain(answers[question.id]);
    }
  });

  test('the answer is Higher exactly when the hidden item costs more', () => {
    specs.forEach((spec, i) => {
      const dearer = (FACTORS[i % FACTORS.length] as number) > 1;
      expect(answers[stableId(spec.slug)]?.startsWith(dearer ? 'Higher, ' : 'Lower, ')).toBe(true);
    });
  });

  test('every level is filled', () => {
    for (const level of DIFFICULTIES) {
      expect(pack.questions.filter((question) => question.difficulty === level).length).toBeGreaterThanOrEqual(
        HIGHER_MIN_PER_LEVEL,
      );
    }
  });
});

describe('buildHigherPack refuses', () => {
  const specs = specsOf(HIGHER_MIN_PACK);

  test('fewer specs than a pack needs', () => {
    const few = specsOf(HIGHER_MIN_PACK - 1);
    expect(() => buildHigherPack(invented(few), few)).toThrow(/specs/);
  });

  test('a list where Higher is right too often: no answer by habit', () => {
    expect(() => buildHigherPack(invented(specs, [2.5, 1.5, 1.2]), specs)).toThrow(/Higher/);
  });

  test('a level with too few questions', () => {
    expect(() => buildHigherPack(invented(specs, [2.5, 1 / 2.5, 1.5, 1 / 1.5]), specs)).toThrow(/hard/);
  });

  test('a hidden item quoted fewer than thirty times, by slug', () => {
    expect(() => buildHigherPack(invented(specs, FACTORS, 29), specs)).toThrow(/higher-001/);
  });

  test('a pair under the floor or over the cap, by slug', () => {
    expect(() => buildHigherPack(invented(specs, [1.05, ...FACTORS.slice(1)]), specs)).toThrow(/higher-001/);
    expect(() => buildHigherPack(invented(specs, [5, ...FACTORS.slice(1)]), specs)).toThrow(/higher-001/);
  });

  test('an item missing from the month, by slug', () => {
    const observed = invented(specs);
    delete observed.quotes[HIGHER_MONTH]?.[specs[0]?.hidden.key as string];
    expect(() => buildHigherPack(observed, specs)).toThrow(/higher-001/);
  });
});
