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

/** Spacings are stepped a point at a time, so compare them with room for float error. */
const EPSILON = 1e-9;

/** Which level a ladder's spacing reads as: the widest whose ratio it reaches. */
export function levelOf(ratio: number): Difficulty {
  if (ratio >= RATIO.easy - EPSILON) return 'easy';
  if (ratio >= RATIO.medium - EPSILON) return 'medium';
  return 'hard';
}

function ladderAt(answer: number, ratio: number, position: number, step: number): number[] {
  return [0, 1, 2, 3].map((i) => (i === position ? answer : roundTo(answer * ratio ** (i - position), step)));
}

/**
 * Spaced at least `MIN_SPACING` apart, none rounded away, and — when `today` is
 * given — exactly the top `over` of the four at or over it, the rest under.
 */
function clear(options: readonly number[], today: number | null, over: 0 | 1): boolean {
  const spaced = options.every(
    (option, i) => option > 0 && (i === 0 || option / (options[i - 1] as number) >= MIN_SPACING),
  );
  if (!spaced || today === null) return spaced;
  return options.every((option, i) => (i >= options.length - over ? option >= today : option < today));
}

/**
 * Four options, low to high, with the answer at `position` and the others a
 * geometric ladder around it, placed against `today`, the price the question
 * gives: **every one under it** (`over: 0`), or **all but the top one**
 * (`over: 1`). The top one is the answer when the price fell or held, and a
 * decoy on about as many questions where it rose — so an option over today's
 * price never says on its own which it is.
 *
 * The level's own spacing where that fits. If rounding pulls two closer than
 * `MIN_SPACING`, or the top rung has to reach today's price, the ladder widens
 * a point at a time; if it would cross today's price too soon, it narrows,
 * never under `MIN_SPACING`. The ratio it settled on comes back with it,
 * because that and not the level it was asked for is how hard the question is.
 *
 * Null when nothing fits. Before 7 October 2026 there was no `today`, and an
 * answer at the bottom of an easy ladder put the top option at 3.4× the
 * answer — over today's price for most items, so in six questions of the first
 * office round (`XRUE`) the only option under today's price was the answer.
 * The first fix put every option under today's price unless the price fell,
 * which made any option over it mean "this got cheaper"; hence the decoys.
 */
export function fitLadder({
  answer,
  ratio,
  position,
  step,
  today,
  over,
}: {
  answer: number;
  ratio: number;
  position: number;
  step: number;
  today: number | null;
  over: 0 | 1;
}): { options: number[]; ratio: number } | null {
  for (let r = ratio; r < ratio + 3; r += 0.01) {
    const options = ladderAt(answer, r, position, step);
    if (clear(options, today, over)) return { options, ratio: r };
  }
  for (let r = ratio - 0.01; r >= MIN_SPACING - EPSILON; r -= 0.01) {
    const options = ladderAt(answer, r, position, step);
    if (clear(options, today, over)) return { options, ratio: r };
  }
  return null;
}

/** One question's part in choosing the decoys. */
export interface DecoyCandidate {
  slug: string;
  group: string;
  /** The price fell or held, so its answer is the option over today's price. */
  fell: boolean;
  /** A ladder with a decoy over today's price fits it. */
  canDecoy: boolean;
}

/**
 * Which rising questions carry a decoy over today's price: in each group, as
 * many as there are questions there whose price fell or held, so an option
 * over today's price is the answer about half the time and a decoy the rest.
 * Chosen by a hash of the slug, salted apart from the places.
 */
export function pickDecoys(items: readonly DecoyCandidate[]): Set<string> {
  const picked = new Set<string>();
  for (const group of new Set(items.map((item) => item.group))) {
    const inGroup = items.filter((item) => item.group === group);
    const wanted = inGroup.filter((item) => item.fell).length;
    const candidates = inGroup
      .filter((item) => !item.fell && item.canDecoy)
      .sort((a, b) => hashOf(a.slug, 'price-decoy').localeCompare(hashOf(b.slug, 'price-decoy')));
    for (const item of candidates.slice(0, wanted)) picked.add(item.slug);
  }
  return picked;
}

/** How far behind the least-used place another may run, to keep a level's own spacing. */
export const POSITION_SLACK = 1;

/** One question waiting for its answer's place. */
export interface Placeable {
  slug: string;
  /** Places are balanced within a group — the gap — not only across the pack. */
  group: string;
  /** The spacing `fitLadder` settles on with the answer in each place, or null where nothing fits. */
  fits: readonly (number | null)[];
  /** The spacing its level asks for. */
  ratio: number;
}

/**
 * Where each answer sits among the four.
 *
 * Each place as often as the ladders allow, within each group. Most items fit
 * anywhere, but a price that barely rose fits only near the top once every
 * option has to stay under today's, so the most constrained are placed first
 * and the rest fill around them. Where the least-used place would narrow the
 * ladder, a place up to `slack` behind it is taken instead if it keeps the
 * level's own spacing — a count one out rather than a harder question. Ties go by a hash of the
 * slug, so neighbours in the file are not a pattern.
 */
export function placeAnswers(items: readonly Placeable[], slack = POSITION_SLACK): Map<string, number> {
  const fitting = (item: Placeable): number[] =>
    [0, 1, 2, 3].filter((place) => item.fits[place] !== null && item.fits[place] !== undefined);
  const order = [...items].sort(
    (a, b) => fitting(a).length - fitting(b).length || hashOf(a.slug).localeCompare(hashOf(b.slug)),
  );

  const counts = new Map<string, number[]>();
  const placed = new Map<string, number>();
  for (const item of order) {
    const places = fitting(item);
    if (places.length === 0) throw new Error(`${item.slug}: no place for the answer fits`);
    const count = counts.get(item.group) ?? [0, 0, 0, 0];
    counts.set(item.group, count);

    const least = Math.min(...places.map((place) => count[place] as number));
    const keeps = (place: number): boolean => (item.fits[place] as number) >= item.ratio - EPSILON;
    const leastUsed = places.filter((place) => count[place] === least);
    const nearlyLeast = places.filter((place) => (count[place] as number) <= least + slack);
    const pool = [leastUsed.filter(keeps), nearlyLeast.filter(keeps), leastUsed].find((some) => some.length > 0) ?? [];
    const place = pool[Number.parseInt(hashOf(item.slug).slice(0, 8), 16) % pool.length] as number;
    placed.set(item.slug, place);
    count[place] = (count[place] as number) + 1;
  }
  return placed;
}

function hashOf(slug: string, salt = 'price-position'): string {
  return createHash('sha1').update(`${salt}:${slug}`).digest('hex');
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
