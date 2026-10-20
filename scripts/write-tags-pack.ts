/**
 * Writes `public/packs/tags.json` — The Price is Right — and merges its answers
 * into `.cache/hand-vault.json` for `seed-vault`.
 *
 * Run: `npm run prices-fetch` (once; it caches the ONS files and every item's
 * median), `npm run tags-draw`, set a `seed` on each spec once somebody has
 * looked at the drawings, then `npm run write-tags-pack`, then
 * `npm run seed-vault -- --pack tags` before anything deploys it. See
 * docs/decisions/price-is-right.md.
 *
 * Refuses, rather than skips, a spec nobody has picked, a drawing Vision never
 * read, and a drawing with any writing on it: a drawn price tag is a number on
 * screen, and a drawn brand is a clue to one.
 *
 * Blind: it reports counts, never a price.
 */

import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { RATIO, fitLadder, formatPence, levelOf, roundTo, stepPence } from './prices-core';
import {
  KIND_LABEL,
  TAGS_MIN_PACK,
  TAGS_MIN_PER_LEVEL,
  TAGS_MIN_QUOTES,
  TAGS_MONTH,
  TAGS_MONTH_LABEL,
  TAG_SPECS,
  type TagSpec,
} from './hand-tags-data';
import { TAGS_TEXT, tagDrawingPath } from './tags-draw';
import { PRICE_SPECS, SPOILED_KEYS, TWIN_KEYS, type PriceSpec } from './hand-prices-data';
import { OBSERVED_PATH, type Observed } from './write-prices-pack';
import { writeSealedPack } from './write-sealed-pack';
import { compressStill, hashAndStore, OUT_DIR, readHandVault, replaceMarkdownSection, stableId } from './write-hand-packs';
import { DIFFICULTIES, PACK_META, sealQuestion, type Difficulty, type Pack, type SealedQuestion } from '../src/questions/types';

export const TAGS_ATTR_MARKER = '## The Price is Right';

/**
 * Slugs whose item The Price Was Right asks, has spoiled, or has a twin of. That
 * pack prints an item's August 2026 price in its question, which is this
 * pack's answer. Meaning-twins under other codes (its 40-inch television and
 * this list's smaller one, say) are kept out by hand: price-is-right.md.
 */
export function overlapsWithPriceWasRight(
  specs: readonly TagSpec[],
  priceSpecs: readonly PriceSpec[] = PRICE_SPECS,
): string[] {
  const asked = new Set([...priceSpecs.map((spec) => spec.key), ...SPOILED_KEYS]);
  for (const [key, other] of Object.entries(TWIN_KEYS)) {
    if (asked.has(key)) asked.add(other);
    if (asked.has(other)) asked.add(key);
  }
  return specs.filter((spec) => asked.has(spec.key)).map((spec) => spec.slug);
}

/** The August 2026 median, in pence, or why the item cannot be asked. */
export function priceFor(spec: TagSpec, observed: Observed): number {
  const quoted = observed.quotes[TAGS_MONTH]?.[spec.key];
  if (!quoted) throw new Error(`${spec.slug}: item not quoted in ${TAGS_MONTH}`);
  if (quoted.n < TAGS_MIN_QUOTES) throw new Error(`${spec.slug}: fewer than ${TAGS_MIN_QUOTES} quotes`);
  return Math.round(quoted.median * 100);
}

/**
 * Easy, medium, hard in turn down the spec list — dropped specs included, so a
 * drop never moves another question's level, its rounding, or its answer.
 */
export function levelsFor(specs: readonly TagSpec[]): Map<string, Difficulty> {
  return new Map(specs.map((spec, i) => [spec.slug, DIFFICULTIES[i % DIFFICULTIES.length] as Difficulty]));
}

const PERMUTATIONS: readonly (readonly number[])[] = (() => {
  const out: number[][] = [];
  const walk = (prefix: number[], rest: number[]): void => {
    if (rest.length === 0) out.push(prefix);
    rest.forEach((place, i) => walk([...prefix, place], [...rest.slice(0, i), ...rest.slice(i + 1)]));
  };
  walk([], [0, 1, 2, 3]);
  return out;
})();

/**
 * Where each answer sits among the four. Every four specs in list order use
 * each place once, in an order a hash of the block picks — so the answer is in
 * each place exactly as often, neighbours make no pattern, and appending specs
 * never moves an earlier answer. Nothing constrains a place here: there is no
 * price in the question for an option to sit over, as The Price Was Right has.
 */
export function placesFor(specs: readonly TagSpec[]): Map<string, number> {
  return new Map(
    specs.map((spec, i) => {
      const block = Math.floor(i / 4);
      const hash = createHash('sha1').update(`tag-places:${block}`).digest();
      const order = PERMUTATIONS[hash.readUInt32BE(0) % PERMUTATIONS.length] as readonly number[];
      return [spec.slug, order[i % 4] as number];
    }),
  );
}

const STEPS = [1, 10, 50, 500, 1_000];

/**
 * What the four options are rounded to: the step for the middle of the ladder
 * the player sees, so the rounding is something the options already show and
 * says nothing about which one is the answer. Finer, if that would leave the
 * cheapest option fewer than five steps of room.
 */
export function stepForLadder(price: number, ratio: number, position: number): number {
  let step = stepPence(price * ratio ** (1.5 - position));
  while (step > 1 && price / ratio ** position < 5 * step) {
    step = STEPS[STEPS.indexOf(step) - 1] ?? 1;
  }
  return step;
}

export interface TaggedQuestion {
  spec: TagSpec;
  answer: string;
  options: string[];
  difficulty: Difficulty;
}

/** The numbers for every spec that ships, before any picture is attached. */
export function priceTags(observed: Observed, specs: readonly TagSpec[] = TAG_SPECS): TaggedQuestion[] {
  const levels = levelsFor(specs);
  const places = placesFor(specs);
  return specs
    .filter((spec) => spec.dropped === undefined)
    .map((spec) => {
      const price = priceFor(spec, observed);
      const ratio = RATIO[levels.get(spec.slug) as Difficulty];
      const position = places.get(spec.slug) as number;
      const step = stepForLadder(price, ratio, position);
      const answerPence = roundTo(price, step);
      if (answerPence <= 0) throw new Error(`${spec.slug}: the answer rounds to nothing`);
      const fitted = fitLadder({ answer: answerPence, ratio, position, step, today: null, over: 0 });
      if (!fitted) throw new Error(`${spec.slug}: no ladder fits`);
      const options = fitted.options.map((pence) => formatPence(pence, step));
      return { spec, answer: options[position] as string, options, difficulty: levelOf(fitted.ratio) };
    });
}

export function tagQuestion(spec: TagSpec): string {
  return `What did ${spec.name} typically cost in UK shops in ${TAGS_MONTH_LABEL}?`;
}

export interface TagsBuildDeps {
  specs?: TagSpec[];
  /** What Vision read off each drawing, keyed by file name. */
  text?: Record<string, string[]>;
  readDrawing?: (path: string) => Promise<Buffer>;
  store?: (png: Buffer) => Promise<string>;
}

async function storeDrawing(png: Buffer): Promise<string> {
  const shrunk = await compressStill(png, 'png');
  return hashAndStore(shrunk.bytes, shrunk.ext);
}

export async function buildTagsPack(
  observed: Observed,
  deps: TagsBuildDeps = {},
): Promise<{ pack: Pack; answers: Record<string, string> }> {
  const specs = deps.specs ?? TAG_SPECS;
  const text = deps.text ?? (JSON.parse(await readFile(TAGS_TEXT, 'utf8')) as Record<string, string[]>);
  const readDrawing = deps.readDrawing ?? ((path: string) => readFile(path));
  const store = deps.store ?? storeDrawing;

  const refused: string[] = [];
  const answers: Record<string, string> = {};
  const questions: SealedQuestion[] = [];

  for (const tagged of priceTags(observed, specs)) {
    const { spec } = tagged;
    if (spec.seed === undefined) {
      refused.push(`${spec.slug}: no drawing picked — set \`seed\` once somebody has looked`);
      continue;
    }
    const path = tagDrawingPath(spec.slug, spec.seed);
    const read = text[basename(path)];
    if (read === undefined) {
      refused.push(`${spec.slug}: Vision never read ${basename(path)} — rerun tags-draw`);
      continue;
    }
    if (read.length > 0) {
      // Not echoed: a drawn number could be a price.
      refused.push(`${spec.slug}: the drawing carries writing — pick another version or drop it`);
      continue;
    }
    const id = stableId(spec.slug);
    const image = await store(await readDrawing(path));
    answers[id] = tagged.answer;
    const sealed = sealQuestion({
      id,
      source: 'hand',
      question: tagQuestion(spec),
      correct: tagged.answer,
      incorrect: tagged.options.filter((option) => option !== tagged.answer),
      category: KIND_LABEL[spec.kind],
      difficulty: tagged.difficulty,
      image,
    });
    questions.push({ ...sealed, options: tagged.options, ordered: true });
  }

  if (refused.length > 0) throw new Error(`Refused ${refused.length} question(s):\n${refused.join('\n')}`);
  if (questions.length < TAGS_MIN_PACK) throw new Error(`Only ${questions.length} questions (need ${TAGS_MIN_PACK})`);
  for (const level of DIFFICULTIES) {
    const n = questions.filter((question) => question.difficulty === level).length;
    if (n < TAGS_MIN_PER_LEVEL) throw new Error(`Only ${n} ${level} questions (need ${TAGS_MIN_PER_LEVEL})`);
  }

  const meta = PACK_META.tags;
  return { pack: { id: 'tags', title: meta.title, blurb: meta.blurb, questions }, answers };
}

function attributionMarkdown(): string {
  return `${TAGS_ATTR_MARKER}

Prices: Office for National Statistics, consumer price inflation item indices and price
quotes, August 2026 — the median of each item's valid shop quotes that month. Contains public
sector information licensed under the [Open Government Licence v3.0](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/).

Pictures drawn for this quiz by [Z-Image-Turbo](https://huggingface.co/Tongyi-MAI/Z-Image-Turbo)
(Tongyi-MAI, Apache 2.0) through [mflux](https://github.com/mflux-community/mflux), on a Mac.
Generic objects, not any shop's product.
`;
}

async function main(): Promise<void> {
  const raw = await readFile(OBSERVED_PATH, 'utf8').catch(() => {
    throw new Error(`No ${OBSERVED_PATH} — run \`npm run prices-fetch\` first`);
  });
  const { pack, answers } = await buildTagsPack(JSON.parse(raw) as Observed);

  // Read before the write below merges over it. A changed answer is one the
  // live vault does not hold, and that question would refuse every reveal.
  const seeded = await readHandVault();
  const changed = Object.keys(answers).filter((id) => id in seeded && seeded[id] !== answers[id]).length;
  const unseeded = Object.keys(answers).filter((id) => !(id in seeded)).length;

  await writeSealedPack(pack, answers, 'tags.json');
  const attribution = join(OUT_DIR, 'ATTRIBUTION.md');
  await writeFile(
    attribution,
    replaceMarkdownSection(await readFile(attribution, 'utf8'), TAGS_ATTR_MARKER, attributionMarkdown()),
  );

  // Counts only: Greg plays this blind.
  const places = [0, 0, 0, 0];
  const levels = new Map<string, number>();
  for (const question of pack.questions) {
    const at = question.options.indexOf(answers[question.id] as string);
    places[at] = (places[at] ?? 0) + 1;
    levels.set(question.difficulty, (levels.get(question.difficulty) ?? 0) + 1);
  }
  console.log(`The Price is Right: ${pack.questions.length} questions`);
  console.log(`  answer in place 1–4: ${places.join(' / ')}`);
  console.log(`  levels: ${[...levels].map(([level, n]) => `${level} ${n}`).join(', ')}`);
  console.log(`  against the vault cache: ${changed} answers changed, ${unseeded} not yet seeded`);
  if (changed > 0) process.exitCode = 1;
}

const runningDirect = process.argv[1]?.includes('write-tags-pack') === true;
if (runningDirect) {
  main().catch((error: unknown) => {
    console.error('write-tags-pack failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
