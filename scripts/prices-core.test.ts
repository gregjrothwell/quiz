import { describe, expect, test } from 'vitest';
import {
  MIN_SPACING,
  RATIO,
  fitLadder,
  formatPence,
  isValidQuote,
  levelOf,
  median,
  parseCsv,
  placeAnswers,
  type Placeable,
  priceQuestion,
  quoteMedians,
  rpiAveragePrices,
  stepFor,
  stepPence,
  unitChangeYear,
} from './prices-core';

/*
  Greg plays this round blind, so every fixture here is invented: no item,
  code or price below is from the ONS files the pack is built from.
*/

describe('parseCsv', () => {
  test('splits plain fields', () => {
    expect(parseCsv('a,b,c\n1,2,3\n')).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ]);
  });

  test('keeps a comma, a doubled quote and a newline inside a quoted field', () => {
    // #given the shapes the ONS files actually use: a description with a comma
    // in it, and a notes cell that runs over several lines
    const text = 'id,desc\n7,"WIDGET, BLUE"\n8,"say ""hi""\nthen go"\n';

    // #then each stays one field
    expect(parseCsv(text)).toEqual([
      ['id', 'desc'],
      ['7', 'WIDGET, BLUE'],
      ['8', 'say "hi"\nthen go'],
    ]);
  });

  test('copes with CRLF and a missing final newline', () => {
    expect(parseCsv('a,b\r\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });
});

describe('isValidQuote', () => {
  test('takes the codes each era of the file uses for a valid quote', () => {
    // Old glossary: "only codes 3 and 4 used". From 2025 the column is a boolean.
    expect(['3', '4', 'True'].every(isValidQuote)).toBe(true);
    expect(['1', '2', 'False', ''].some(isValidQuote)).toBe(false);
  });
});

describe('median', () => {
  test('is the middle value, or the mean of the middle two', () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });

  test('refuses an empty list rather than inventing a price', () => {
    expect(() => median([])).toThrow();
  });
});

describe('quoteMedians', () => {
  const header = 'QUOTE_DATE,ITEM_ID,ITEM_DESC,VALIDITY,SHOP_CODE,PRICE';

  test('takes the median of valid, positive quotes for one month, per item', () => {
    // #given two months, one invalid quote and one zero price
    const rows = parseCsv(
      [
        header,
        '201901,900001,TOY BOAT,3,1,2.00',
        '201901,900001,TOY BOAT,4,2,4.00',
        '201901,900001,TOY BOAT,3,3,3.00',
        '201901,900001,TOY BOAT,1,4,99.00',
        '201901,900001,TOY BOAT,3,5,0',
        '201902,900001,TOY BOAT,3,1,50.00',
      ].join('\n'),
    );

    // #when January is read
    const medians = quoteMedians(rows, '201901');

    // #then only the three valid January quotes count
    expect(medians.get('900001')).toEqual({ desc: 'TOY BOAT', median: 3, n: 3 });
  });

  test('reads the newer column names too', () => {
    const rows = parseCsv(
      'QUOTE_DATE,CS_ID,CS_DESC,VALIDITY,SHOP_CODE,PRICE\n202501,900002,"KITE, RED",True,1,1.5\n',
    );
    expect(quoteMedians(rows, '202501').get('900002')).toEqual({ desc: 'KITE, RED', median: 1.5, n: 1 });
  });
});

describe('rpiAveragePrices', () => {
  test('reads the average-price series by CDID, in pence, by month', () => {
    // #given the MM23 shape: titles, then CDIDs, then metadata, then data rows
    const rows = parseCsv(
      [
        '"Title","CPI wts: Something","RPI: Ave price - Widgets, each"',
        '"CDID","AAAA","ZZZ1"',
        '"Unit","Parts","Pence"',
        '"1990","1","2"',
        '"1990 JAN","1","40"',
        '"2020 JAN","1",""',
      ].join('\n'),
    );

    // #when read
    const series = rpiAveragePrices(rows);

    // #then only the average-price column comes back, blanks left out
    expect([...series.keys()]).toEqual(['ZZZ1']);
    expect(series.get('ZZZ1')).toEqual({ title: 'RPI: Ave price - Widgets, each', pence: { '1990 JAN': 40 } });
  });
});

describe('stepPence and formatPence', () => {
  test('the step follows the price the question gives, so it leaks nothing', () => {
    expect(stepPence(65)).toBe(1);
    expect(stepPence(349)).toBe(10);
    expect(stepPence(2_400)).toBe(50);
    expect(stepPence(44_900)).toBe(500);
    expect(stepPence(120_000)).toBe(1_000);
  });

  test('under a pound reads in pence, over it in pounds', () => {
    expect(formatPence(65)).toBe('65p');
    expect(formatPence(220)).toBe('£2.20');
    expect(formatPence(800)).toBe('£8.00');
    expect(formatPence(30_000, 500)).toBe('£300');
    expect(formatPence(125_000, 1_000)).toBe('£1,250');
  });
});

describe('stepFor', () => {
  test('is the given price\'s step when the answer has room under it', () => {
    expect(stepFor(349, 220, 1.3)).toBe(10);
  });

  test('drops to a finer step when a price fell so far the cheapest option would round away', () => {
    // #given a later price of £3.49 and an answer of 12p
    // #then 10p steps would leave the lowest option at nothing, so pence are used
    expect(stepFor(349, 12, 1.3)).toBe(1);
  });
});

describe('unitChangeYear', () => {
  test('reads the year an RPI series changed what it measures', () => {
    expect(unitChangeYear('Oranges, each (per Kg prior to Feb 1988)')).toBe(1988);
    expect(unitChangeYear('White fish fillets, per Kg (cod prior Feb 02)')).toBe(2002);
    expect(unitChangeYear('Ultra low sulphur diesel, per litre (Derv prior to Feb 2000)')).toBe(2000);
    expect(unitChangeYear('Tea bags, per 250g')).toBeNull();
  });
});

describe('fitLadder', () => {
  test('puts the answer where it is told to, the rest a ratio apart', () => {
    // #given an answer of £2.00 in third place, a medium spacing, nothing above it
    const fitted = fitLadder({ answer: 200, ratio: RATIO.medium, position: 2, step: 10, below: null });

    // #then four, rising, with the answer third, at the level's own spacing
    expect(fitted?.options).toHaveLength(4);
    expect(fitted?.options[2]).toBe(200);
    expect([...(fitted?.options ?? [])].sort((a, b) => a - b)).toEqual(fitted?.options);
    expect(fitted?.ratio).toBeCloseTo(RATIO.medium, 5);
  });

  test('every pair is at least the minimum spacing apart, even after rounding', () => {
    // #given small prices and the tightest ratio, where rounding bites hardest
    for (const answer of [9, 23, 47, 120, 130, 990, 1_950, 23_000]) {
      for (const position of [0, 1, 2, 3]) {
        const step = stepPence(answer);
        const fitted = fitLadder({ answer, ratio: RATIO.hard, position, step, below: null });
        const options = fitted?.options ?? [];

        // #then each is clear of the one below it, and a multiple of the step
        expect(options).toHaveLength(4);
        for (let i = 1; i < options.length; i += 1) {
          expect((options[i] as number) / (options[i - 1] as number)).toBeGreaterThanOrEqual(MIN_SPACING);
        }
        for (const option of options) expect(option % step).toBe(0);
        expect(options[position]).toBe(answer);
      }
    }
  });

  test('keeps every option under today\'s price, the giveaway Greg saw in XRUE', () => {
    // #given a price that rose by half: £1.00 then, £1.50 now, answer at the bottom
    const fitted = fitLadder({ answer: 100, ratio: RATIO.easy, position: 0, step: 1, below: 150 });

    // #then nothing reaches today's price, so no option rules itself out
    expect(fitted).not.toBeNull();
    for (const option of fitted?.options ?? []) expect(option).toBeLessThan(150);
    expect(fitted?.options[0]).toBe(100);
  });

  test('narrows the spacing to fit under today, never below the minimum', () => {
    // #given the same rise: an easy ×1.5 ladder from the bottom would reach £3.38
    const fitted = fitLadder({ answer: 100, ratio: RATIO.easy, position: 0, step: 1, below: 150 });

    // #then it is narrower than easy, and no narrower than 12%
    expect(fitted?.ratio).toBeLessThan(RATIO.easy);
    expect(fitted?.ratio).toBeGreaterThanOrEqual(MIN_SPACING - 1e-9);
  });

  test('keeps the level\'s spacing when it already fits under today', () => {
    const fitted = fitLadder({ answer: 100, ratio: RATIO.easy, position: 3, step: 1, below: 150 });
    expect(fitted?.ratio).toBeCloseTo(RATIO.easy, 5);
  });

  test('says nothing fits rather than breaking the rule', () => {
    // #given a rise of 10%: three options above the answer cannot all be under today
    expect(fitLadder({ answer: 100, ratio: RATIO.hard, position: 0, step: 1, below: 110 })).toBeNull();
    // #then the answer on top still fits
    expect(fitLadder({ answer: 100, ratio: RATIO.hard, position: 3, step: 1, below: 110 })).not.toBeNull();
  });

  test('wider spacing for an easier question', () => {
    expect(RATIO.easy).toBeGreaterThan(RATIO.medium);
    expect(RATIO.medium).toBeGreaterThan(RATIO.hard);
    expect(RATIO.hard).toBeGreaterThanOrEqual(MIN_SPACING);
  });
});

describe('levelOf', () => {
  test('reads a spacing as the widest level it reaches', () => {
    expect(levelOf(RATIO.easy)).toBe('easy');
    expect(levelOf(RATIO.easy + 0.2)).toBe('easy');
    expect(levelOf(RATIO.medium)).toBe('medium');
    expect(levelOf(RATIO.easy - 0.01)).toBe('medium');
    expect(levelOf(RATIO.medium - 0.01)).toBe('hard');
    expect(levelOf(MIN_SPACING)).toBe('hard');
  });
});

describe('placeAnswers', () => {
  const slugs = Array.from({ length: 96 }, (_, i) => `price-${String(i + 1).padStart(3, '0')}`);
  const free = (slug: string, group = 'g'): Placeable => ({
    slug,
    group,
    ratio: RATIO.medium,
    fits: [RATIO.medium, RATIO.medium, RATIO.medium, RATIO.medium],
  });

  /** How often the answer landed in each place. */
  function tally(placed: Map<string, number>, among: readonly string[]): number[] {
    const counts = [0, 0, 0, 0];
    for (const slug of among) {
      const at = placed.get(slug) as number;
      counts[at] = (counts[at] ?? 0) + 1;
    }
    return counts;
  }

  test('puts the answer in each of the four places equally often when every place fits', () => {
    const counts = tally(placeAnswers(slugs.map((slug) => free(slug))), slugs);
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
  });

  test('balances each group on its own', () => {
    const placed = placeAnswers(slugs.map((slug, i) => free(slug, i % 2 === 0 ? 'five' : 'thirty')));
    for (const group of [0, 1]) {
      const counts = tally(placed, slugs.filter((_, i) => i % 2 === group));
      expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
    }
  });

  test('only ever uses a place that fits', () => {
    // #given a quarter that only fit on top, as a price that barely rose does
    const items = slugs.map((slug, i) =>
      i % 4 === 0 ? { ...free(slug), fits: [null, null, null, RATIO.hard] } : free(slug),
    );
    const placed = placeAnswers(items);

    // #then those are all on top, and the rest fill the other places to compensate
    items.forEach((item) => {
      expect(item.fits[placed.get(item.slug) as number]).not.toBeNull();
    });
    const counts = tally(placed, slugs);
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(2);
  });

  test('gives up a little balance to keep a level\'s own spacing', () => {
    // #given items whose bottom place only fits narrowed, the rest at full spacing
    const items = slugs.map((slug) => ({ ...free(slug), fits: [RATIO.hard, RATIO.medium, RATIO.medium, RATIO.medium] }));
    const placed = placeAnswers(items, 1);

    // #then the bottom is used less, but never more than two behind
    const counts = tally(placed, slugs);
    expect(counts[0]).toBeLessThan(counts[1] as number);
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(2);
  });

  test('does not follow slug order, so neighbours in the file are not a pattern', () => {
    const twelve = slugs.slice(0, 12);
    const placed = placeAnswers(twelve.map((slug) => free(slug)));
    expect(twelve.map((slug) => placed.get(slug))).not.toEqual([0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3]);
  });

  test('refuses an item with nowhere to go', () => {
    expect(() => placeAnswers([{ ...free('price-001'), fits: [null, null, null, null] }])).toThrow(/price-001/);
  });
});

describe('priceQuestion', () => {
  test('gives the later price and both dates, and asks for the earlier', () => {
    expect(
      priceQuestion({ name: 'a toy boat', later: 'August 2026', earlier: 'August 2016', laterPence: 349 }),
    ).toBe('In August 2026, a toy boat cost about £3.50. What did it cost in August 2016?');
  });
});
