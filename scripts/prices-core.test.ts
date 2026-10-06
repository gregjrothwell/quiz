import { describe, expect, test } from 'vitest';
import {
  MIN_SPACING,
  RATIO,
  balancedPositions,
  formatPence,
  isValidQuote,
  median,
  optionPence,
  parseCsv,
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

describe('optionPence', () => {
  test('puts the answer where it is told to, the rest a ratio apart', () => {
    // #given an answer of £2.00 in third place, a medium spacing
    const options = optionPence({ answer: 200, ratio: RATIO.medium, position: 2, step: 10 });

    // #then four, rising, with the answer third
    expect(options).toHaveLength(4);
    expect(options[2]).toBe(200);
    expect([...options].sort((a, b) => a - b)).toEqual(options);
  });

  test('every pair is at least the minimum spacing apart, even after rounding', () => {
    // #given small prices and the tightest ratio, where rounding bites hardest
    for (const answer of [9, 23, 47, 120, 130, 990, 1_950, 23_000]) {
      for (const position of [0, 1, 2, 3]) {
        const step = stepPence(answer);
        const options = optionPence({ answer, ratio: RATIO.hard, position, step });

        // #then each is clear of the one below it, and a multiple of the step
        for (let i = 1; i < options.length; i += 1) {
          expect((options[i] as number) / (options[i - 1] as number)).toBeGreaterThanOrEqual(MIN_SPACING);
        }
        for (const option of options) expect(option % step).toBe(0);
        expect(options[position]).toBe(answer);
      }
    }
  });

  test('wider spacing for an easier question', () => {
    expect(RATIO.easy).toBeGreaterThan(RATIO.medium);
    expect(RATIO.medium).toBeGreaterThan(RATIO.hard);
    expect(RATIO.hard).toBeGreaterThanOrEqual(MIN_SPACING);
  });
});

describe('balancedPositions', () => {
  test('puts the answer in each of the four places equally often', () => {
    const slugs = Array.from({ length: 95 }, (_, i) => `price-${String(i + 1).padStart(3, '0')}`);
    const positions = balancedPositions(slugs);
    const counts = [0, 0, 0, 0];
    for (const slug of slugs) {
      const at = positions.get(slug) as number;
      counts[at] = (counts[at] ?? 0) + 1;
    }
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
  });

  test('does not follow slug order, so neighbours in the file are not a pattern', () => {
    const slugs = Array.from({ length: 12 }, (_, i) => `price-${String(i + 1).padStart(3, '0')}`);
    const positions = balancedPositions(slugs);
    const inOrder = slugs.map((slug) => positions.get(slug));
    expect(inOrder).not.toEqual([0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3]);
  });
});

describe('priceQuestion', () => {
  test('gives the later price and both dates, and asks for the earlier', () => {
    expect(
      priceQuestion({ name: 'a toy boat', later: 'August 2026', earlier: 'August 2016', laterPence: 349 }),
    ).toBe('In August 2026, a toy boat cost about £3.50. What did it cost in August 2016?');
  });
});
