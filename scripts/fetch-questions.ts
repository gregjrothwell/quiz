/**
 * One-off harvest of the Open Trivia DB verified question pool into committed
 * JSON packs. Run with `npm run fetch-questions`.
 *
 * Committing the output rather than calling the API at runtime means the game
 * has no third-party domain to reach, no rate limit to respect mid-quiz, and no
 * API key to leak in a static bundle.
 *
 * Data: Open Trivia DB, CC BY-SA 4.0 — https://opentdb.com
 */

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { sortIntoPacks } from './classify';
import { harvestOpenTriviaQA } from './opentriviaqa';
import {
  DIFFICULTIES,
  PACK_META,
  sealQuestion,
  type Difficulty,
  type DifficultyCounts,
  type Pack,
  type PackSummary,
  type Question,
} from '../src/questions/types';
import { retiredIds } from '../src/questions/retired';

const API = 'https://opentdb.com';
const OUT_DIR = join(import.meta.dirname, '..', 'public', 'packs');

/**
 * The harvested pool is cached so that tuning the classification rules only
 * costs a re-sort, not another ten minutes of throttled requests.
 * Run with `--resort` to skip the network entirely.
 */
const CACHE_DIR = join(import.meta.dirname, '..', '.cache');
const POOL_CACHE = join(CACHE_DIR, 'pool.json');

/**
 * The answers, kept out of `public/` and out of git. See `writeVault`.
 * Shared with scripts/seed-vault.ts, which uploads it.
 */
export const VAULT_CACHE = join(CACHE_DIR, 'vault.json');

/**
 * Page sizes, tried largest first.
 *
 * OpenTDB answers a request for more questions than it can supply with
 * `response_code: 1` and an *empty* array — it does not return the remainder.
 * So a single fixed page size silently discards the tail of every category, and
 * discards a whole bucket outright whenever it holds fewer than one page.
 *
 * Asking per difficulty as well as per category made that far worse: it split
 * the pool into three times as many buckets, most of them under 50, and cost
 * roughly a quarter of the available questions — every category with no bucket
 * over 50 came back completely empty. Difficulty is read from each question
 * instead, and the ladder below drains what a fixed page size leaves behind.
 */
const PAGE_SIZES = [50, 20, 5, 1] as const;

/** OpenTDB allows one request per IP per 5 seconds. */
const THROTTLE_MS = 5_200;
const MAX_RETRIES = 4;

interface TriviaCategory {
  id: number;
  name: string;
}

interface CategoryListResponse {
  trivia_categories: TriviaCategory[];
}

interface ApiQuestion {
  category: string;
  type: string;
  difficulty: string;
  question: string;
  correct_answer: string;
  incorrect_answers: string[];
}

interface ApiResponse {
  response_code: number;
  results: ApiQuestion[];
}

const RESPONSE = {
  success: 0,
  noResults: 1,
  invalidParameter: 2,
  tokenNotFound: 3,
  tokenEmpty: 4,
  rateLimit: 5,
} as const;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function decode(value: string): string {
  return Buffer.from(value, 'base64').toString('utf8');
}

function stableId(prompt: string): string {
  return createHash('sha1').update(prompt).digest('hex').slice(0, 12);
}

function isDifficulty(value: string): value is Difficulty {
  return value === 'easy' || value === 'medium' || value === 'hard';
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`);
  return (await response.json()) as T;
}

async function fetchCategories(): Promise<TriviaCategory[]> {
  const data = await getJson<CategoryListResponse>(`${API}/api_category.php`);
  return data.trivia_categories;
}

async function requestToken(): Promise<string> {
  const data = await getJson<{ token: string }>(`${API}/api_token.php?command=request`);
  return data.token;
}

/**
 * Session tokens make OpenTDB stop repeating questions it has already served,
 * which is how we page through a category rather than drawing the same 50 twice.
 */
async function fetchPage(categoryId: number, amount: number, token: string): Promise<ApiResponse> {
  const url =
    `${API}/api.php?amount=${amount}&category=${categoryId}` +
    `&type=multiple&encode=base64&token=${token}`;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    await sleep(THROTTLE_MS);
    const data = await getJson<ApiResponse>(url);

    if (data.response_code !== RESPONSE.rateLimit) return data;

    const backoff = THROTTLE_MS * (attempt + 2);
    process.stdout.write(` rate-limited, backing off ${backoff / 1000}s…`);
    await sleep(backoff);
  }

  throw new Error(`Rate limited ${MAX_RETRIES} times on category ${categoryId}`);
}

function toQuestion(raw: ApiQuestion): Question | null {
  const difficulty = decode(raw.difficulty);
  if (!isDifficulty(difficulty)) return null;

  const prompt = decode(raw.question);
  return {
    id: stableId(prompt),
    question: prompt,
    correct: decode(raw.correct_answer),
    incorrect: raw.incorrect_answers.map(decode),
    category: decode(raw.category),
    difficulty,
    source: 'opentdb',
  };
}

/**
 * Drains one category. Pages at the largest size until the API stops supplying
 * one, then steps down the ladder — a "not enough questions" answer means the
 * remainder is smaller than the page, not that the category is finished.
 */
async function harvestCategory(
  categoryId: number,
  token: string,
  collect: (question: Question) => void,
): Promise<number> {
  let harvested = 0;

  for (const amount of PAGE_SIZES) {
    for (;;) {
      const page = await fetchPage(categoryId, amount, token);

      // The token has served every question this category has.
      if (page.response_code === RESPONSE.tokenEmpty) return harvested;

      // Fewer than `amount` left. A smaller page may still find them.
      if (page.response_code === RESPONSE.noResults) break;

      if (page.response_code !== RESPONSE.success) {
        console.warn(`  ! category ${categoryId} returned code ${page.response_code}, skipping`);
        return harvested;
      }

      for (const raw of page.results) {
        const question = toQuestion(raw);
        if (question) {
          collect(question);
          harvested += 1;
        }
      }
    }
  }

  return harvested;
}

async function harvest(): Promise<Question[]> {
  const categories = await fetchCategories();
  const token = await requestToken();
  const byId = new Map<string, Question>();

  console.log(`Harvesting ${categories.length} categories.`);
  console.log(`Throttled to one request every ${THROTTLE_MS / 1000}s — expect 20-30 minutes.\n`);

  for (const category of categories) {
    // Keyed by id so a question served twice collapses to one entry.
    const found = await harvestCategory(category.id, token, (question) => {
      byId.set(question.id, question);
    });
    process.stdout.write(`  ${category.name.padEnd(38)} ${String(found).padStart(5)}\n`);
  }

  return [...byId.values()];
}

function countByDifficulty(questions: readonly Question[]): DifficultyCounts {
  const counts: DifficultyCounts = { easy: 0, medium: 0, hard: 0 };
  for (const question of questions) counts[question.difficulty] += 1;
  return counts;
}

/**
 * The other half of a sealed pack: question id to the text of its answer.
 *
 * Written under `.cache/`, which is gitignored — committing this file, or
 * publishing it under `public/`, would undo the entire point of sealing the
 * packs. `npm run seed-vault` uploads it to Firestore, where the rules make it
 * unreadable to every client but still visible to the rules themselves.
 *
 * Keyed by question id and drawn from the packs rather than the raw pool, so it
 * holds answers for exactly the questions that shipped and no others.
 */
async function writeVault(packs: ReadonlyMap<string, Question[]>): Promise<void> {
  const answers: Record<string, string> = {};
  for (const questions of packs.values()) {
    for (const question of questions) answers[question.id] = question.correct;
  }

  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(VAULT_CACHE, `${JSON.stringify(answers)}\n`, 'utf8');
  console.log(`\nVault written: ${Object.keys(answers).length} answers → ${VAULT_CACHE}`);
  console.log('Run `npm run seed-vault` to publish them to Firestore.');
}

async function writePacks(rawPool: Question[]): Promise<void> {
  /*
    The office's own verdicts, applied before anything is sorted.

    This is the step that makes a retirement stick. Removing a question from
    `public/packs/*.json` by hand achieves nothing, because this script rebuilds
    every pack from `.cache/` and would put it straight back — silently, and
    with no record that it had ever been voted out. The blocklist is the record;
    the packs are downstream of it.

    Filtered here rather than inside `sortIntoPacks` so the count can be
    reported beside the other drops, and so a retired question never reaches the
    vault either, which `writeVault` builds from the packs.
  */
  const retired = retiredIds();
  const pool = rawPool.filter((question) => !retired.has(question.id));
  const retiredOut = rawPool.length - pool.length;

  const { packs, dropped } = sortIntoPacks(pool);
  await mkdir(OUT_DIR, { recursive: true });

  const written: PackSummary[] = [];

  for (const [packId, questions] of [...packs.entries()].sort()) {
    const meta = PACK_META[packId];
    // Sealed on the way out. The published pack lists the options and says
    // nothing about which is right; the answers go to the vault instead.
    const pack: Pack = {
      id: packId,
      title: meta.title,
      blurb: meta.blurb,
      questions: questions.map(sealQuestion),
    };
    await writeFile(join(OUT_DIR, `${packId}.json`), `${JSON.stringify(pack)}\n`, 'utf8');
    written.push({
      id: packId,
      title: meta.title,
      blurb: meta.blurb,
      count: questions.length,
      counts: countByDifficulty(questions),
    });
  }

  await writeFile(join(OUT_DIR, 'index.json'), `${JSON.stringify(written, null, 2)}\n`, 'utf8');
  await writeFile(join(OUT_DIR, 'ATTRIBUTION.md'), ATTRIBUTION, 'utf8');
  await writeVault(packs);

  console.log(`\nSorted ${pool.length} unique questions.`);
  if (retiredOut > 0) {
    console.log(`Held back ${retiredOut} the office voted out — see src/questions/retired.json.`);
  }
  console.log(
    `Dropped ${dropped.malformed} malformed, ${dropped.usOnly} US-only, ` +
      `${dropped.offTopicSport} sport with no UK-followed sport in it, ` +
      `${dropped.capped} over the pack cap.\n`,
  );
  for (const pack of written) {
    const spread = DIFFICULTIES.map((level) => `${level[0]}${pack.counts[level]}`).join(' ');
    console.log(`  ${pack.id.padEnd(20)} ${String(pack.count).padStart(5)}   ${spread}`);
  }
}

const ATTRIBUTION = `# Question data attribution

Questions in this directory are derived from two sources, both published under
the [Creative Commons Attribution-ShareAlike 4.0 International Licence](https://creativecommons.org/licenses/by-sa/4.0/):

- The [Open Trivia Database](https://opentdb.com)
- [OpenTriviaQA](https://github.com/uberspot/OpenTriviaQA)

Sharing a licence is what makes the two poolable. A third source considered and
rejected, [The Trivia API](https://the-trivia-api.com), is CC BY-**NC** — its
NonCommercial term cannot be combined into a ShareAlike work.

## What we changed

- From Open Trivia DB: fetched only the verified question pool, via the public
  API, and decoded the base64 transport encoding to plain UTF-8
- From OpenTriviaQA: parsed the flat-file category format, decoding each file as
  UTF-8 or CP1252 as its contents require, and kept only four-option questions
- Removed questions whose text the source had already damaged — stripped
  apostrophes, double-encoded characters
- Removed structurally unusable questions: duplicate answer options, unresolved
  HTML entities, order-dependent options such as "all of the above", and
  questions whose answer decays over time
- Removed questions specific to the United States, which land poorly with a UK
  audience
- Tagged questions carrying British reference points into a separate
  \`uk-leaning\` pack
- Grouped the remainder into themed packs by source category, capped so no
  single pack becomes an unreasonable download
- Marked OpenTriviaQA questions as medium difficulty, the source carrying no
  difficulty rating of its own

## Licence of this derived work

Because both sources are ShareAlike, these derived packs are also released under
**CC BY-SA 4.0**. If you reuse them, credit the Open Trivia Database and
OpenTriviaQA, and keep the same licence.
`;

/**
 * The cache on disk predates `source`, so it is read as a shape where the field
 * may be missing and filled in on the way through. An entry left without one
 * would be ranked as an import, and the cap would then trim the only questions
 * carrying a real difficulty rating.
 */
type CachedQuestion = Omit<Question, 'source'> & { source?: Question['source'] };

async function loadCachedPool(): Promise<Question[]> {
  const raw = await readFile(POOL_CACHE, 'utf8');
  const pool = JSON.parse(raw) as CachedQuestion[];
  return pool.map((question) => ({ ...question, source: question.source ?? 'opentdb' }));
}

/**
 * One pool from both corpora, keyed by id so a question both of them carry is
 * asked once. Open Trivia DB wins a collision: its copy is the one with a real
 * difficulty rating, and the ids match because both are `sha1(prompt)`.
 */
function merge(rated: Question[], imported: Question[]): Question[] {
  const byId = new Map(imported.map((question) => [question.id, question]));
  for (const question of rated) byId.set(question.id, question);
  return [...byId.values()];
}

async function main(): Promise<void> {
  const resort = process.argv.includes('--resort');

  const rated = resort ? await loadCachedPool() : await harvest();
  if (rated.length === 0) throw new Error('Empty pool — refusing to write empty packs');

  if (!resort) {
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(POOL_CACHE, `${JSON.stringify(rated)}\n`, 'utf8');
  } else {
    console.log(`Re-sorting ${rated.length} cached questions (no network).\n`);
  }

  const pool = merge(rated, await harvestOpenTriviaQA(resort));
  console.log(`Pool: ${pool.length} questions from both sources.\n`);

  await writePacks(pool);
}

main().catch((error: unknown) => {
  console.error('\nfetch-questions failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
