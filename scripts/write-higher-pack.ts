/**
 * Writes `public/packs/higher.json` — Higher or Lower — and merges its
 * answers into `.cache/hand-vault.json` for `seed-vault`.
 *
 * Run: `npm run prices-fetch` (keeps the ONS files in `.cache/prices/raw/`),
 * then `npm run write-higher-pack`, then `npm run seed-vault -- --pack higher`
 * before anything deploys it. See docs/decisions/higher-or-lower.md.
 *
 * Blind: it reports counts, never a price.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  HIGHER_MIN_PACK,
  HIGHER_MIN_PER_LEVEL,
  HIGHER_MIN_QUOTES,
  HIGHER_MONTH,
  HIGHER_SPECS,
  type HigherSpec,
} from './hand-higher-data';
import { higherOptions, higherPrices, higherQuestion, levelOfPair, shownPence } from './higher-core';
import { parseCsv, quoteMedians } from './prices-core';
import { OBSERVED_PATH, type Observed } from './write-prices-pack';
import { readHandVault, stableId } from './write-hand-packs';
import { writeSealedPack } from './write-sealed-pack';
import { DIFFICULTIES, PACK_META, sealQuestion, type Difficulty, type Pack } from '../src/questions/types';

/** Higher must be right this share of the time, overall and at each level. */
const BALANCE: readonly [number, number] = [0.45, 0.55];

const QUOTES_PATH = join(OBSERVED_PATH, '..', 'raw', `quotes-${HIGHER_MONTH}.csv`);

/** One item's price in pence, or why it cannot be asked. */
function priceOf(spec: HigherSpec, key: string, observed: Observed): number {
  const quote = observed.quotes[HIGHER_MONTH]?.[key];
  if (!quote) throw new Error(`${spec.slug}: item not quoted in ${HIGHER_MONTH}`);
  if (quote.n < HIGHER_MIN_QUOTES) throw new Error(`${spec.slug}: fewer than ${HIGHER_MIN_QUOTES} quotes`);
  return Math.round(quote.median * 100);
}

function share(correct: readonly number[]): number {
  return correct.filter((index) => index === 0).length / correct.length;
}

export function buildHigherPack(
  observed: Observed,
  specs: readonly HigherSpec[] = HIGHER_SPECS,
): { pack: Pack; answers: Record<string, string> } {
  if (specs.length < HIGHER_MIN_PACK) throw new Error(`Only ${specs.length} specs (need ${HIGHER_MIN_PACK})`);

  const answers: Record<string, string> = {};
  const correctBy = new Map<Difficulty, number[]>(DIFFICULTIES.map((level) => [level, []]));
  const questions = specs.map((spec) => {
    const given = shownPence(priceOf(spec, spec.shown.key, observed));
    const real = priceOf(spec, spec.hidden.key, observed);
    const { higher, lower } = higherPrices(given, real);
    const level = higher > given && given > lower ? levelOfPair(Math.sqrt(higher / lower)) : null;
    if (!level) throw new Error(`${spec.slug}: the two prices are too close together or too far apart`);

    const { options, correctIndex } = higherOptions(given, real);
    const id = stableId(spec.slug);
    answers[id] = options[correctIndex];
    correctBy.get(level)?.push(correctIndex);

    const sealed = sealQuestion({
      id,
      source: 'hand',
      question: higherQuestion({ shown: spec.shown.name, hidden: spec.hidden.name, shownPence: given }),
      correct: options[correctIndex],
      incorrect: [options[1 - correctIndex] as string],
      category: 'Higher or Lower',
      difficulty: level,
    });
    return { ...sealed, options: [...options], ordered: true };
  });

  for (const [level, correct] of correctBy) {
    if (correct.length < HIGHER_MIN_PER_LEVEL) {
      throw new Error(`Only ${correct.length} ${level} questions (need ${HIGHER_MIN_PER_LEVEL})`);
    }
  }
  const [low, high] = BALANCE;
  for (const [label, correct] of [['overall', [...correctBy.values()].flat()], ...correctBy] as const) {
    const higherShare = share(correct);
    if (higherShare < low || higherShare > high) {
      throw new Error(`Higher is right in ${Math.round(higherShare * 100)}% of ${label} questions (need 45–55%)`);
    }
  }

  const meta = PACK_META.higher;
  return { pack: { id: 'higher', title: meta.title, blurb: meta.blurb, questions }, answers };
}

/** The month's medians, straight from the raw file `prices-fetch` keeps. */
export async function observedMonth(): Promise<Observed> {
  const raw = await readFile(QUOTES_PATH, 'utf8').catch(() => {
    throw new Error(`No ${QUOTES_PATH} — run \`npm run prices-fetch\` first`);
  });
  const medians = quoteMedians(parseCsv(raw), HIGHER_MONTH);
  return { quotes: { [HIGHER_MONTH]: Object.fromEntries(medians) }, rpi: {} };
}

async function main(): Promise<void> {
  const { pack, answers } = buildHigherPack(await observedMonth());

  // Read before the write below merges over it. A changed answer is one the
  // live vault does not hold, and that question would refuse every reveal.
  const seeded = await readHandVault();
  const changed = Object.keys(answers).filter((id) => id in seeded && seeded[id] !== answers[id]).length;
  const unseeded = Object.keys(answers).filter((id) => !(id in seeded)).length;

  await writeSealedPack(pack, answers, 'higher.json');

  // Counts only: Greg plays this blind.
  console.log(`Higher or Lower: ${pack.questions.length} questions`);
  for (const level of DIFFICULTIES) {
    const these = pack.questions.filter((question) => question.difficulty === level);
    const higher = these.filter((question) => answers[question.id] === question.options[0]).length;
    console.log(`  ${level}: ${these.length}, Higher right in ${higher}`);
  }
  console.log(`  against the vault cache: ${changed} answers changed, ${unseeded} not yet seeded`);
  if (changed > 0) process.exitCode = 1;
}

const runningDirect = process.argv[1]?.includes('write-higher-pack') === true;
if (runningDirect) {
  main().catch((error: unknown) => {
    console.error('write-higher-pack failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
