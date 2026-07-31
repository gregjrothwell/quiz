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
import { sortIntoPacks } from '../src/questions/classify';
import { PACK_META, type Difficulty, type Pack, type PackId, type Question } from '../src/questions/types';

const API = 'https://opentdb.com';
const OUT_DIR = join(import.meta.dirname, '..', 'public', 'packs');

/**
 * The harvested pool is cached so that tuning the classification rules only
 * costs a re-sort, not another ten minutes of throttled requests.
 * Run with `--resort` to skip the network entirely.
 */
const CACHE_DIR = join(import.meta.dirname, '..', '.cache');
const POOL_CACHE = join(CACHE_DIR, 'pool.json');
const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];
const PAGE_SIZE = 50;

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
async function fetchPage(
  categoryId: number,
  difficulty: Difficulty,
  token: string,
): Promise<ApiResponse> {
  const url =
    `${API}/api.php?amount=${PAGE_SIZE}&category=${categoryId}` +
    `&difficulty=${difficulty}&type=multiple&encode=base64&token=${token}`;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    await sleep(THROTTLE_MS);
    const data = await getJson<ApiResponse>(url);

    if (data.response_code !== RESPONSE.rateLimit) return data;

    const backoff = THROTTLE_MS * (attempt + 2);
    process.stdout.write(` rate-limited, backing off ${backoff / 1000}s…`);
    await sleep(backoff);
  }

  throw new Error(`Rate limited ${MAX_RETRIES} times on category ${categoryId}/${difficulty}`);
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
  };
}

async function harvest(): Promise<Question[]> {
  const categories = await fetchCategories();
  const token = await requestToken();
  const byId = new Map<string, Question>();

  console.log(`Harvesting ${categories.length} categories × ${DIFFICULTIES.length} difficulties.`);
  console.log(`Throttled to one request every ${THROTTLE_MS / 1000}s — expect roughly 10 minutes.\n`);

  for (const category of categories) {
    for (const difficulty of DIFFICULTIES) {
      let pageCount = 0;

      // Page until the token reports it has served everything it has.
      for (;;) {
        const page = await fetchPage(category.id, difficulty, token);

        if (page.response_code === RESPONSE.tokenEmpty || page.response_code === RESPONSE.noResults) {
          break;
        }
        if (page.response_code !== RESPONSE.success) {
          console.warn(
            `  ! ${category.name}/${difficulty} returned code ${page.response_code}, skipping`,
          );
          break;
        }

        for (const raw of page.results) {
          const question = toQuestion(raw);
          // Keyed by id so a question served twice collapses to one entry.
          if (question) byId.set(question.id, question);
        }

        pageCount += 1;
        if (page.results.length < PAGE_SIZE) break;
      }

      if (pageCount > 0) {
        process.stdout.write(`  ${category.name} / ${difficulty}: ${pageCount} page(s)\n`);
      }
    }
  }

  return [...byId.values()];
}

async function writePacks(pool: Question[]): Promise<void> {
  const { packs, dropped } = sortIntoPacks(pool);
  await mkdir(OUT_DIR, { recursive: true });

  const written: { id: PackId; title: string; blurb: string; count: number }[] = [];

  for (const [packId, questions] of [...packs.entries()].sort()) {
    const meta = PACK_META[packId];
    const pack: Pack = { id: packId, title: meta.title, blurb: meta.blurb, questions };
    await writeFile(join(OUT_DIR, `${packId}.json`), `${JSON.stringify(pack)}\n`, 'utf8');
    written.push({ id: packId, title: meta.title, blurb: meta.blurb, count: questions.length });
  }

  await writeFile(join(OUT_DIR, 'index.json'), `${JSON.stringify(written, null, 2)}\n`, 'utf8');
  await writeFile(join(OUT_DIR, 'ATTRIBUTION.md'), ATTRIBUTION, 'utf8');

  console.log(`\nHarvested ${pool.length} unique questions.`);
  console.log(`Dropped ${dropped.malformed} malformed, ${dropped.usOnly} US-only.\n`);
  for (const pack of written) {
    console.log(`  ${pack.id.padEnd(20)} ${String(pack.count).padStart(5)}`);
  }
}

const ATTRIBUTION = `# Question data attribution

Questions in this directory are derived from the
[Open Trivia Database](https://opentdb.com), which publishes its data under the
[Creative Commons Attribution-ShareAlike 4.0 International Licence](https://creativecommons.org/licenses/by-sa/4.0/).

## What we changed

- Fetched only the verified question pool, via the public API
- Decoded the base64 transport encoding to plain UTF-8
- Removed structurally unusable questions: duplicate answer options, unresolved
  HTML entities, order-dependent options such as "all of the above", and
  questions whose answer decays over time
- Removed questions specific to the United States, which land poorly with a UK
  audience
- Tagged questions carrying British reference points into a separate
  \`uk-leaning\` pack
- Grouped the remainder into themed packs by source category

## Licence of this derived work

Because the source is ShareAlike, these derived packs are also released under
**CC BY-SA 4.0**. If you reuse them, credit the Open Trivia Database and keep
the same licence.
`;

async function loadCachedPool(): Promise<Question[]> {
  const raw = await readFile(POOL_CACHE, 'utf8');
  return JSON.parse(raw) as Question[];
}

async function main(): Promise<void> {
  const resort = process.argv.includes('--resort');

  const pool = resort ? await loadCachedPool() : await harvest();
  if (pool.length === 0) throw new Error('Empty pool — refusing to write empty packs');

  if (!resort) {
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(POOL_CACHE, `${JSON.stringify(pool)}\n`, 'utf8');
  } else {
    console.log(`Re-sorting ${pool.length} cached questions (no network).\n`);
  }

  await writePacks(pool);
}

main().catch((error: unknown) => {
  console.error('\nfetch-questions failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
