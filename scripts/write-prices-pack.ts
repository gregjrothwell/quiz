/**
 * Writes `public/packs/prices.json` — The Price Was Right — and merges its
 * answers into `.cache/hand-vault.json` for `seed-vault`.
 *
 * Run: `npm run prices-fetch` (downloads the ONS files, computes the prices),
 * then `npm run write-prices-pack`, then `npm run seed-vault -- --pack prices`
 * before anything deploys it. See docs/decisions/price-was-right.md.
 *
 * Blind: it reports counts, never a price.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  RATIO,
  balancedPositions,
  formatPence,
  optionPence,
  priceQuestion,
  roundTo,
  stepFor,
  unitChangeYear,
  type QuoteMedian,
  type RpiSeries,
} from './prices-core';
import {
  GAPS,
  PRICE_SPECS,
  PRICES_MIN_PACK,
  PRICES_MIN_QUOTES,
  type PriceSpec,
} from './hand-prices-data';
import { stableId } from './write-hand-packs';
import { writeSealedPack } from './write-sealed-pack';
import { DIFFICULTIES, PACK_META, sealQuestion, type Difficulty, type Pack } from '../src/questions/types';

/** What `prices-fetch` leaves in `.cache/prices/observed.json`. */
export interface Observed {
  /** Month (`202608`) → item code → that month's median. */
  quotes: Record<string, Record<string, QuoteMedian>>;
  /** CDID → series, trimmed to the months the gaps read. */
  rpi: Record<string, RpiSeries>;
}

export const OBSERVED_PATH = join(import.meta.dirname, '..', '.cache', 'prices', 'observed.json');

/** The two prices a spec compares, in pence, or why it cannot be asked. */
export function pricesFor(spec: PriceSpec, observed: Observed): { later: number; earlier: number } {
  const gap = GAPS[spec.gap];
  if (gap.source === 'quotes') {
    const later = observed.quotes[gap.later]?.[spec.key];
    const earlier = observed.quotes[gap.earlier]?.[spec.key];
    if (!later || !earlier) throw new Error(`${spec.slug}: item not quoted in both months`);
    if (later.desc !== earlier.desc) throw new Error(`${spec.slug}: the item's description changed between the months`);
    if (later.n < PRICES_MIN_QUOTES || earlier.n < PRICES_MIN_QUOTES) {
      throw new Error(`${spec.slug}: fewer than ${PRICES_MIN_QUOTES} quotes in a month`);
    }
    return { later: Math.round(later.median * 100), earlier: Math.round(earlier.median * 100) };
  }

  const series = observed.rpi[spec.key];
  const later = series?.pence[gap.later];
  const earlier = series?.pence[gap.earlier];
  if (!series || later === undefined || earlier === undefined) {
    throw new Error(`${spec.slug}: series has no value in one of the months`);
  }
  const changed = unitChangeYear(series.title);
  if (changed !== null && changed > Number(gap.earlier.slice(0, 4))) {
    throw new Error(`${spec.slug}: the series changed its unit inside the gap`);
  }
  return { later: Math.round(later), earlier: Math.round(earlier) };
}

/** Easy, medium, hard in turn within each gap, so every gap has every level. */
export function difficultiesFor(specs: readonly PriceSpec[]): Map<string, Difficulty> {
  const seen = new Map<number, number>();
  return new Map(
    specs.map((spec) => {
      const i = seen.get(spec.gap) ?? 0;
      seen.set(spec.gap, i + 1);
      return [spec.slug, DIFFICULTIES[i % DIFFICULTIES.length] as Difficulty];
    }),
  );
}

export function buildPricesPack(
  observed: Observed,
  specs: readonly PriceSpec[] = PRICE_SPECS,
): { pack: Pack; answers: Record<string, string> } {
  if (specs.length < PRICES_MIN_PACK) throw new Error(`Only ${specs.length} specs (need ${PRICES_MIN_PACK})`);

  const positions = balancedPositions(specs.map((spec) => spec.slug));
  const levels = difficultiesFor(specs);
  const answers: Record<string, string> = {};

  const questions = specs.map((spec) => {
    const { later, earlier } = pricesFor(spec, observed);
    const difficulty = levels.get(spec.slug) as Difficulty;
    const position = positions.get(spec.slug) as number;
    const ratio = RATIO[difficulty];
    const step = stepFor(later, earlier, ratio);
    const answer = roundTo(earlier, step);
    if (answer <= 0) throw new Error(`${spec.slug}: the answer rounds to nothing`);

    const options = optionPence({ answer, ratio, position, step }).map((pence) => formatPence(pence, step));
    const correct = options[position] as string;
    const gap = GAPS[spec.gap];
    const id = stableId(spec.slug);
    answers[id] = correct;

    const sealed = sealQuestion({
      id,
      source: 'hand',
      question: priceQuestion({ name: spec.name, later: gap.laterLabel, earlier: gap.earlierLabel, laterPence: later }),
      correct,
      incorrect: options.filter((_, i) => i !== position),
      category: `${spec.gap} years ago`,
      difficulty,
    });
    // `sealQuestion` sorts alphabetically, which puts £12 before £3. Low to high
    // instead, and `ordered` so the client does not shuffle them back.
    return { ...sealed, options, ordered: true };
  });

  const meta = PACK_META.prices;
  return { pack: { id: 'prices', title: meta.title, blurb: meta.blurb, questions }, answers };
}

async function main(): Promise<void> {
  const raw = await readFile(OBSERVED_PATH, 'utf8').catch(() => {
    throw new Error(`No ${OBSERVED_PATH} — run \`npm run prices-fetch\` first`);
  });
  const { pack, answers } = buildPricesPack(JSON.parse(raw) as Observed);
  await writeSealedPack(pack, answers, 'prices.json');
  const byGap = new Map<string, number>();
  for (const question of pack.questions) byGap.set(question.category, (byGap.get(question.category) ?? 0) + 1);
  console.log(`The Price Was Right: ${pack.questions.length} questions`, Object.fromEntries(byGap));
}

const runningDirect = process.argv[1]?.includes('write-prices-pack') === true;
if (runningDirect) {
  main().catch((error: unknown) => {
    console.error('write-prices-pack failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
