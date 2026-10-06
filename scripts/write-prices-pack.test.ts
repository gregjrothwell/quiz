import { describe, expect, test } from 'vitest';
import {
  GAPS,
  PRICE_SPECS,
  PRICES_MIN_PACK,
  PRICES_MIN_PER_GAP,
  PRICES_MIN_PER_LEVEL,
  SPOILED_KEYS,
  type PriceSpec,
} from './hand-prices-data';
import { MIN_SPACING } from './prices-core';
import { buildPricesPack, pricesFor, type Observed } from './write-prices-pack';
import { DIFFICULTIES } from '../src/questions/types';

/*
  Greg plays this round blind. The prices below are invented — a made-up
  observation for every spec — so nothing in this file, or in a failure from
  it, is a real price. Real ones live only in `.cache/prices/observed.json`.
*/

/** A made-up observation for every spec: later prices vary, earlier ones are 70% of them. */
function invented(specs: readonly PriceSpec[] = PRICE_SPECS): Observed {
  const observed: Observed = { quotes: {}, rpi: {} };
  specs.forEach((spec, i) => {
    const gap = GAPS[spec.gap];
    const later = [0.85, 3.4, 12.5, 49, 420][i % 5] as number;
    if (gap.source === 'quotes') {
      for (const [month, price] of [[gap.later, later], [gap.earlier, later * 0.7]] as const) {
        observed.quotes[month] ??= {};
        (observed.quotes[month] as Record<string, unknown>)[spec.key] = { desc: `ITEM ${spec.key}`, median: price, n: 40 };
      }
    } else {
      observed.rpi[spec.key] = {
        title: `RPI: Ave price - item ${spec.key}`,
        pence: { [gap.later]: later * 100, [gap.earlier]: later * 70 },
      };
    }
  });
  return observed;
}

function pence(option: string): number {
  return option.endsWith('p') ? Number(option.slice(0, -1)) : Math.round(Number(option.replace(/[£,]/g, '')) * 100);
}

describe('the specs', () => {
  test('have unique slugs and keys, and enough of them', () => {
    expect(new Set(PRICE_SPECS.map((spec) => spec.slug)).size).toBe(PRICE_SPECS.length);
    expect(new Set(PRICE_SPECS.map((spec) => spec.key)).size).toBe(PRICE_SPECS.length);
    expect(PRICE_SPECS.length).toBeGreaterThanOrEqual(PRICES_MIN_PACK);
  });

  test('never ask about an item Greg has already seen the price of', () => {
    const spoiled = PRICE_SPECS.filter((spec) => SPOILED_KEYS.includes(spec.key)).map((spec) => spec.slug);
    expect(spoiled).toEqual([]);
  });

  test('cover every gap at least fifteen times', () => {
    for (const gap of [5, 10, 20, 30] as const) {
      expect(PRICE_SPECS.filter((spec) => spec.gap === gap).length).toBeGreaterThanOrEqual(PRICES_MIN_PER_GAP);
    }
  });

  test('let no one kind of shopping be more than a quarter of the pack', () => {
    const counts = new Map<string, number>();
    for (const spec of PRICE_SPECS) counts.set(spec.kind, (counts.get(spec.kind) ?? 0) + 1);
    const over = [...counts].filter(([, n]) => n > PRICE_SPECS.length / 4).map(([kind]) => kind);
    expect(over).toEqual([]);
  });

  test('name each item in plain English, lower case, ready to follow "In August 2026,"', () => {
    const bad = PRICE_SPECS.filter((spec) => !/^[a-z0-9]/.test(spec.name) || /[A-Z]{4,}/.test(spec.name));
    expect(bad.map((spec) => spec.slug)).toEqual([]);
  });

  test('read shop quotes for 5 and 10 years and RPI series for 20 and 30', () => {
    // Shop quote codes are six digits; RPI CDIDs are four characters.
    const wrong = PRICE_SPECS.filter((spec) =>
      GAPS[spec.gap].source === 'quotes' ? !/^\d{6}$/.test(spec.key) : !/^[A-Z0-9]{4}$/.test(spec.key),
    );
    expect(wrong.map((spec) => spec.slug)).toEqual([]);
  });
});

describe('buildPricesPack', () => {
  const { pack, answers } = buildPricesPack(invented());

  test('makes a question of every spec, every level at least fifteen times', () => {
    expect(pack.questions).toHaveLength(PRICE_SPECS.length);
    for (const level of DIFFICULTIES) {
      expect(pack.questions.filter((q) => q.difficulty === level).length).toBeGreaterThanOrEqual(PRICES_MIN_PER_LEVEL);
    }
  });

  test('is sealed: no answer field, and the vault answer is one of the four options', () => {
    for (const question of pack.questions) {
      expect(Object.keys(question)).not.toContain('correct');
      expect(question.options).toContain(answers[question.id]);
    }
  });

  test('shows the options low to high, at least the minimum spacing apart', () => {
    for (const question of pack.questions) {
      const values = question.options.map(pence);
      for (let i = 1; i < values.length; i += 1) {
        expect((values[i] as number) / (values[i - 1] as number)).toBeGreaterThanOrEqual(MIN_SPACING);
      }
    }
  });

  test('puts the answer in each of the four places about equally often', () => {
    const counts = [0, 0, 0, 0];
    for (const question of pack.questions) {
      const at = question.options.indexOf(answers[question.id] as string);
      counts[at] = (counts[at] ?? 0) + 1;
    }
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
  });

  test('names both dates and the gap', () => {
    const question = pack.questions.find((q) => q.category === '30 years ago');
    expect(question?.question).toMatch(/^In January 2025, .+ What did it cost in January 1995\?$/);
  });
});

describe('pricesFor refuses a price it cannot stand behind', () => {
  const quoteSpec = PRICE_SPECS.find((spec) => spec.gap === 10) as PriceSpec;
  const rpiSpec = PRICE_SPECS.find((spec) => spec.gap === 30) as PriceSpec;

  test('an item whose description changed between the months', () => {
    const observed = invented([quoteSpec]);
    const earlier = observed.quotes[GAPS[10].earlier]?.[quoteSpec.key];
    if (earlier) earlier.desc = 'SOMETHING ELSE';
    expect(() => pricesFor(quoteSpec, observed)).toThrow(/description changed/);
  });

  test('a median that stands on too few quotes', () => {
    const observed = invented([quoteSpec]);
    const later = observed.quotes[GAPS[10].later]?.[quoteSpec.key];
    if (later) later.n = 12;
    expect(() => pricesFor(quoteSpec, observed)).toThrow(/fewer than/);
  });

  test('a series that changed its unit inside the gap', () => {
    const observed = invented([rpiSpec]);
    const series = observed.rpi[rpiSpec.key];
    if (series) series.title = 'RPI: Ave price - item, each (per Kg prior to Feb 2001)';
    expect(() => pricesFor(rpiSpec, observed)).toThrow(/unit/);
  });

  test('a month with no value', () => {
    const observed = invented([rpiSpec]);
    const series = observed.rpi[rpiSpec.key];
    if (series) delete series.pence[GAPS[30].earlier];
    expect(() => pricesFor(rpiSpec, observed)).toThrow(/no value/);
  });
});
