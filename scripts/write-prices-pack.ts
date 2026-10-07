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
  fitLadder,
  formatPence,
  levelOf,
  pickDecoys,
  placeAnswers,
  priceQuestion,
  roundTo,
  stepFor,
  stepPence,
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
import { readHandVault, stableId } from './write-hand-packs';
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

/** One spec's numbers, before its answer has a place. */
interface Priced {
  spec: PriceSpec;
  later: number;
  answer: number;
  step: number;
  ratio: number;
  /** Today's price as the question shows it. */
  today: number;
  /** The price fell or held: the answer is the one option at or over today's. */
  fell: boolean;
}

/** How many options sit at or over today's price, and where the answer may go. */
interface Shape {
  over: 0 | 1;
  places: readonly number[];
}

/**
 * Fell or held: the answer on top, the only option at or over today's. Rose
 * with a decoy: the decoy on top over today's, the answer in any place under
 * it. Rose otherwise: all four under today's, the answer anywhere.
 */
function shapeOf(item: Priced, decoy: boolean): Shape {
  if (item.fell) return { over: 1, places: [3] };
  if (decoy) return { over: 1, places: [0, 1, 2] };
  return { over: 0, places: [0, 1, 2, 3] };
}

function fitsFor(item: Priced, shape: Shape): (number | null)[] {
  const { answer, ratio, step, today } = item;
  return [0, 1, 2, 3].map((position) =>
    shape.places.includes(position)
      ? (fitLadder({ answer, ratio, position, step, today, over: shape.over })?.ratio ?? null)
      : null,
  );
}

export function buildPricesPack(
  observed: Observed,
  specs: readonly PriceSpec[] = PRICE_SPECS,
): { pack: Pack; answers: Record<string, string> } {
  if (specs.length < PRICES_MIN_PACK) throw new Error(`Only ${specs.length} specs (need ${PRICES_MIN_PACK})`);

  // The level dealt in turn still sets the rounding step, and so the answer:
  // those were seeded into the vault on 6 October, and a different rounding
  // would be a different answer string. It no longer decides the level shown.
  const levels = difficultiesFor(specs);
  const priced: Priced[] = specs.map((spec) => {
    const { later, earlier } = pricesFor(spec, observed);
    const ratio = RATIO[levels.get(spec.slug) as Difficulty];
    const step = stepFor(later, earlier, ratio);
    const answer = roundTo(earlier, step);
    if (answer <= 0) throw new Error(`${spec.slug}: the answer rounds to nothing`);
    const today = roundTo(later, stepPence(later));
    return { spec, later, answer, step, ratio, today, fell: answer >= today };
  });

  const decoys = pickDecoys(
    priced.map((item) => ({
      slug: item.spec.slug,
      group: String(item.spec.gap),
      fell: item.fell,
      canDecoy: !item.fell && fitsFor(item, shapeOf(item, true)).some((fit) => fit !== null),
    })),
  );
  const shapes = new Map(priced.map((item) => [item.spec.slug, shapeOf(item, decoys.has(item.spec.slug))]));
  const positions = placeAnswers(
    priced.map((item) => ({
      slug: item.spec.slug,
      group: String(item.spec.gap),
      fits: fitsFor(item, shapes.get(item.spec.slug) as Shape),
      ratio: item.ratio,
    })),
  );

  const answers: Record<string, string> = {};
  const questions = priced.map(({ spec, later, answer, step, ratio, today }) => {
    const position = positions.get(spec.slug) as number;
    const { over } = shapes.get(spec.slug) as Shape;
    const fitted = fitLadder({ answer, ratio, position, step, today, over });
    if (!fitted) throw new Error(`${spec.slug}: placed where no ladder fits`);

    const options = fitted.options.map((pence) => formatPence(pence, step));
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
      difficulty: levelOf(fitted.ratio),
    });
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

  // Read before the write below merges over it. A changed answer is one the
  // live vault does not hold, and that question would refuse every reveal.
  const seeded = await readHandVault();
  const changed = Object.keys(answers).filter((id) => id in seeded && seeded[id] !== answers[id]).length;
  const unseeded = Object.keys(answers).filter((id) => !(id in seeded)).length;

  await writeSealedPack(pack, answers, 'prices.json');

  // Counts only: Greg plays this blind.
  const byGap = new Map<string, number[]>();
  const levels = new Map<string, number>();
  for (const question of pack.questions) {
    const places = byGap.get(question.category) ?? [0, 0, 0, 0];
    const at = question.options.indexOf(answers[question.id] as string);
    places[at] = (places[at] ?? 0) + 1;
    byGap.set(question.category, places);
    levels.set(question.difficulty, (levels.get(question.difficulty) ?? 0) + 1);
  }
  console.log(`The Price Was Right: ${pack.questions.length} questions`);
  for (const [gap, places] of byGap) console.log(`  ${gap}: answer in place 1–4 ${places.join(' / ')}`);
  console.log(`  levels: ${[...levels].map(([level, n]) => `${level} ${n}`).join(', ')}`);
  console.log(`  against the vault cache: ${changed} answers changed, ${unseeded} not yet seeded`);
  if (changed > 0) process.exitCode = 1;
}

const runningDirect = process.argv[1]?.includes('write-prices-pack') === true;
if (runningDirect) {
  main().catch((error: unknown) => {
    console.error('write-prices-pack failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
