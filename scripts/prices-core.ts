/**
 * The pure half of The Price Was Right: reading the ONS files, the price each
 * question is built on, and the four options it shows. No network and no files
 * — `prices-fetch.ts` downloads, `write-prices-pack.ts` writes. See
 * docs/decisions/price-was-right.md.
 *
 * Greg plays this round blind: nothing here prints a price.
 */

import { createHash } from 'node:crypto';
import type { Difficulty } from '../src/questions/types';

/**
 * RFC 4180 CSV: quoted fields may hold commas, doubled quotes and newlines.
 * The ONS files use all three — item descriptions carry commas, and the MM23
 * notes cell runs over several lines.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/**
 * Whether a shop quote counts. Before 2025 the column is a code, and the
 * glossary says "only codes 3 and 4 used"; from 2025 it is a boolean.
 */
export function isValidQuote(validity: string): boolean {
  return validity === '3' || validity === '4' || validity === 'True';
}

export function median(values: readonly number[]): number {
  if (values.length === 0) throw new Error('No values to take a median of');
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[middle] as number)
    : ((sorted[middle - 1] as number) + (sorted[middle] as number)) / 2;
}

export interface QuoteMedian {
  desc: string;
  /** Pounds, as the file has it. */
  median: number;
  /** How many valid quotes it is the median of. */
  n: number;
}

function column(header: readonly string[], ...names: string[]): number {
  const at = header.findIndex((name) => names.includes(name.trim().toUpperCase()));
  if (at < 0) throw new Error(`No ${names.join(' or ')} column`);
  return at;
}

/** Per item, the median of one month's valid, positive shop quotes. */
export function quoteMedians(rows: readonly string[][], month: string): Map<string, QuoteMedian> {
  const [header = [], ...body] = rows;
  const at = {
    month: column(header, 'QUOTE_DATE'),
    code: column(header, 'ITEM_ID', 'CS_ID'),
    desc: column(header, 'ITEM_DESC', 'CS_DESC'),
    validity: column(header, 'VALIDITY'),
    price: column(header, 'PRICE'),
  };

  const prices = new Map<string, { desc: string; values: number[] }>();
  for (const row of body) {
    if (row[at.month] !== month || !isValidQuote(row[at.validity] ?? '')) continue;
    const price = Number(row[at.price]);
    if (!Number.isFinite(price) || price <= 0) continue;
    const code = row[at.code] ?? '';
    const entry = prices.get(code) ?? { desc: (row[at.desc] ?? '').trim(), values: [] };
    entry.values.push(price);
    prices.set(code, entry);
  }

  const medians = new Map<string, QuoteMedian>();
  for (const [code, { desc, values }] of prices) {
    medians.set(code, { desc, median: median(values), n: values.length });
  }
  return medians;
}

export interface RpiSeries {
  title: string;
  /** Pence, keyed as the file keys months: `2025 JAN`. */
  pence: Record<string, number>;
}

/** The RPI average-price series in MM23, by CDID. Blank months are left out. */
export function rpiAveragePrices(rows: readonly string[][]): Map<string, RpiSeries> {
  const titles = rows.find((row) => row[0] === 'Title') ?? [];
  const cdids = rows.find((row) => row[0] === 'CDID') ?? [];
  const months = rows.filter((row) => /^\d{4} [A-Z]{3}$/.test(row[0] ?? ''));

  const series = new Map<string, RpiSeries>();
  titles.forEach((title, i) => {
    if (i === 0 || !/ave price/i.test(title)) return;
    const pence: Record<string, number> = {};
    for (const row of months) {
      const value = row[i]?.trim();
      if (value) pence[row[0] as string] = Number(value);
    }
    series.set(cdids[i] ?? '', { title, pence });
  });
  return series;
}

/**
 * The year an RPI series changed what it measures, from its title — `(per Kg
 * prior to Feb 1988)`, `(cod prior Feb 02)` — or null. A question whose gap
 * spans that year would compare two different things.
 */
export function unitChangeYear(title: string): number | null {
  const match = /prior(?: to)? [A-Za-z]{3} (\d{2}|\d{4})\b/.exec(title);
  if (!match?.[1]) return null;
  const year = Number(match[1]);
  return match[1].length === 2 ? (year < 50 ? 2000 + year : 1900 + year) : year;
}

/** Options at least this far apart, as a ratio — 12%. */
export const MIN_SPACING = 1.12;

/** How far apart the four options start: wider is easier. */
export const RATIO: Record<Difficulty, number> = { easy: 1.5, medium: 1.3, hard: 1.16 };

/**
 * What a price is rounded to, chosen from the price the question **gives** —
 * so the rounding says nothing about the answer. Coarse enough to wipe out a
 * shop's .99, which a computed option would never have.
 */
export function stepPence(laterPence: number): number {
  if (laterPence < 100) return 1;
  if (laterPence < 1_000) return 10;
  if (laterPence < 5_000) return 50;
  if (laterPence < 50_000) return 500;
  return 1_000;
}

const STEPS = [1, 10, 50, 500, 1_000];

/**
 * The step for a question's options: the given price's, unless that is too
 * coarse for the cheapest option to keep five steps of room — a price that fell
 * a long way would otherwise round its lowest options to nothing.
 */
export function stepFor(laterPence: number, answerPence: number, ratio: number): number {
  let step = stepPence(laterPence);
  while (step > 1 && answerPence / ratio ** 3 < 5 * step) {
    step = STEPS[STEPS.indexOf(step) - 1] ?? 1;
  }
  return step;
}

export function roundTo(pence: number, step: number): number {
  return Math.round(pence / step) * step;
}

export function formatPence(pence: number, step = 1): string {
  if (pence < 100) return `${pence}p`;
  if (step >= 100) return `£${(pence / 100).toLocaleString('en-GB')}`;
  return `£${(pence / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Four options, low to high, with the answer at `position` and the others a
 * geometric ladder around it. If rounding pulls two closer than `MIN_SPACING`,
 * the ladder widens a point at a time until none are.
 */
export function optionPence({
  answer,
  ratio,
  position,
  step,
}: {
  answer: number;
  ratio: number;
  position: number;
  step: number;
}): number[] {
  for (let r = ratio; r < ratio + 3; r += 0.01) {
    const options = [0, 1, 2, 3].map((i) => (i === position ? answer : roundTo(answer * r ** (i - position), step)));
    const clear = options.every(
      (option, i) => option > 0 && (i === 0 || option / (options[i - 1] as number) >= MIN_SPACING),
    );
    if (clear) return options;
  }
  throw new Error(`No ladder fits an answer of ${answer} at step ${step}`);
}

/**
 * Where the answer sits among the four, per slug: each place equally often,
 * dealt in an order taken from a hash so it does not follow the file.
 */
export function balancedPositions(slugs: readonly string[]): Map<string, number> {
  const hashed = [...slugs].sort((a, b) => hashOf(a).localeCompare(hashOf(b)));
  return new Map(hashed.map((slug, i) => [slug, i % 4]));
}

function hashOf(slug: string): string {
  return createHash('sha1').update(`price-position:${slug}`).digest('hex');
}

export function priceQuestion({
  name,
  later,
  earlier,
  laterPence,
}: {
  name: string;
  later: string;
  earlier: string;
  laterPence: number;
}): string {
  const step = stepPence(laterPence);
  return `In ${later}, ${name} cost about ${formatPence(roundTo(laterPence, step), step)}. What did it cost in ${earlier}?`;
}
