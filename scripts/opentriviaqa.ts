/**
 * The second question source: OpenTriviaQA, a flat-file trivia corpus of roughly
 * 50,000 questions. Used to fix the thin packs — Sport was 125 questions, which
 * is eight weekly rounds before it starts repeating itself.
 *
 * Data: https://github.com/uberspot/OpenTriviaQA, CC BY-SA 4.0 — the same
 * licence as Open Trivia DB, which is what makes the two poolable at all.
 */

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Question } from '../src/questions/types';

const RAW = 'https://raw.githubusercontent.com/uberspot/OpenTriviaQA/master/categories';
const CACHE_DIR = join(import.meta.dirname, '..', '.cache');
const SOURCE_CACHE = join(CACHE_DIR, 'opentriviaqa.json');

/**
 * Source file to the category a player sees on the lectern chip.
 *
 * Deliberately reuses Open Trivia DB's category vocabulary rather than the
 * source's own file names: the chip is rendered in `QuestionScreen`, so a round
 * drawing on both sources would otherwise alternate between "Sports" and
 * "sports". It also means `packForCategory` routes these without a second
 * mapping to keep in step with the first.
 *
 * Files with no themed home of their own are named presentably and left to fall
 * through to `mixed-bag`, which is the same treatment their Open Trivia DB
 * counterparts get.
 */
const FILE_CATEGORIES: ReadonlyMap<string, string> = new Map([
  ['animals', 'Science & Nature'],
  ['brain-teasers', 'Brain Teasers'],
  ['celebrities', 'Celebrities'],
  ['entertainment', 'Entertainment'],
  ['for-kids', 'General Knowledge'],
  ['general', 'General Knowledge'],
  ['geography', 'Geography'],
  ['history', 'History'],
  ['hobbies', 'Hobbies'],
  ['humanities', 'Humanities'],
  ['literature', 'Entertainment: Books'],
  ['movies', 'Entertainment: Film'],
  ['music', 'Entertainment: Music'],
  ['newest', 'General Knowledge'],
  ['people', 'People'],
  ['rated', 'Entertainment: Film'],
  ['religion-faith', 'Religion'],
  ['science-technology', 'Science & Nature'],
  ['sports', 'Sports'],
  ['television', 'Entertainment: Television'],
  ['video-games', 'Entertainment: Video Games'],
  ['world', 'Geography'],
]);

/**
 * The 0x80–0x9F range, which is the only place cp1252 and Latin-1 disagree.
 *
 * **`new TextDecoder('windows-1252')` does not do this in Node.** Every cp1252
 * label — `windows-1252`, `cp1252`, `x-cp1252` — decodes as Latin-1, which maps
 * these bytes to C1 control characters instead of to punctuation. Since this is
 * exactly the range holding curly quotes, dashes and ellipses, and those are
 * exactly the characters a trivia corpus is full of, the result is a question
 * that renders with invisible control characters where its apostrophes were.
 * It fails silently: the string is valid, just wrong.
 */
const CP1252_HIGH = [
  '€', '', '‚', 'ƒ', '„', '…', '†', '‡',
  'ˆ', '‰', 'Š', '‹', 'Œ', '', 'Ž', '',
  '', '‘', '’', '“', '”', '•', '–', '—',
  '˜', '™', 'š', '›', 'œ', '', 'ž', 'Ÿ',
];

function decodeCp1252(bytes: Buffer): string {
  let out = '';
  for (const byte of bytes) {
    out += byte >= 0x80 && byte <= 0x9f ? CP1252_HIGH[byte - 0x80] : String.fromCharCode(byte);
  }
  return out;
}

/**
 * Twelve of the twenty-two files are cp1252 and ten are UTF-8, so the encoding
 * has to be decided per file rather than for the corpus.
 *
 * Decoding everything as cp1252 — which the handover note assumed — turns every
 * accented character in the other ten into mojibake, and the damage is silent:
 * "RenÃ©e Zellweger" is a perfectly valid string. Strict UTF-8 first is the
 * check, because a cp1252 file that happens to contain a high byte is not valid
 * UTF-8 and throws, while a UTF-8 file always decodes cleanly.
 */
export function decodeSource(bytes: Buffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return decodeCp1252(bytes);
  }
}

/**
 * Text the source itself has already damaged, most of it apostrophes stripped
 * somewhere upstream ("dont", "youre") and some of it double-encoded before it
 * was ever committed. About 5% of the corpus, and cheaper to drop than to repair
 * — a question that renders as "RenÃ©e Zellweger" on the lectern looks like our
 * bug, not theirs.
 */
const STRIPPED_APOSTROPHE =
  /\b(aint|cant|dont|wont|didnt|isnt|wasnt|couldnt|shouldnt|wouldnt|youre|theyre|weve|ive|whats|thats|lets|doesnt|havent|hasnt|arent|werent|whos)\b/i;
/**
 * A C1 control character means the text was mangled before we read it.
 *
 * These files are valid UTF-8 whose *contents* were double-encoded upstream:
 * "Siddhartha" with a macron arrives as an A-umlaut followed by U+0081, which
 * decodes cleanly and is still wrong. Nothing in a trivia question legitimately
 * contains U+0080-U+009F, so their presence is the tell.
 *
 * The second half catches the other shape, where both characters stay printable:
 * "Renee" with an acute arrives as "RenÃ©e", a C3 lead byte followed by a
 * Latin-1 continuation. Neither pattern subsumes the other, so both are needed.
 */
const MOJIBAKE = /[\u0080-\u009f\ufffd]|\u00e2\u20ac|[\u00c2\u00c3][\u0080-\u00ff]/;

/**
 * Questions that point at something we cannot show.
 *
 * The source was scraped from quizzes that had an image or an audio clip beside
 * the text, and the reference survived the scrape while the media did not:
 * "Which WWF group does this theme music belong to?" parses perfectly and is
 * unanswerable on a lectern. Unlike the encoding damage these read as ordinary
 * English, so nothing else catches them.
 */
const ORPHANED_MEDIA =
  /\b(?:this|the)\s+(?:image|picture|photo|photograph|song|clip|audio|video|sound|theme\s+music|logo)\b|\b(?:shown|pictured|depicted|heard)\s+(?:above|below|here)\b/i;

export function isUndamaged(text: string): boolean {
  return !STRIPPED_APOSTROPHE.test(text) && !MOJIBAKE.test(text) && !ORPHANED_MEDIA.test(text);
}

function stableId(prompt: string): string {
  return createHash('sha1').update(prompt).digest('hex').slice(0, 12);
}

export interface ParsedBlock {
  prompt: string;
  correct: string;
  options: string[];
}

/**
 * One question per blank-line-separated block:
 *
 *   #Q What is the capital of France?
 *   ^ Paris
 *   A London
 *   B Paris
 *   ...
 *
 * The answer is repeated among the options rather than referenced by letter, so
 * a block whose `^` line matches none of them is malformed and dropped.
 */
export function parseBlocks(text: string): ParsedBlock[] {
  const blocks: ParsedBlock[] = [];

  for (const block of text.split(/\n\s*\n/)) {
    const lines = block.split('\n').map((line) => line.trimEnd()).filter((line) => line.trim());
    const question = lines.find((line) => line.startsWith('#Q '));
    const answer = lines.find((line) => line.startsWith('^ '));
    const options = lines.filter((line) => /^[A-Z] /.test(line)).map((line) => line.slice(2).trim());

    if (!question || !answer) continue;
    const correct = answer.slice(2).trim();

    // Four lecterns, so anything else is unusable — which is most of the 6,669
    // true/false pairs as well as a handful with five or more options.
    if (options.length !== 4) continue;
    if (!options.includes(correct)) continue;

    blocks.push({ prompt: question.slice(3).trim(), correct, options });
  }

  return blocks;
}

async function fetchCategory(file: string): Promise<string> {
  const response = await fetch(`${RAW}/${file}`);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${file}`);
  return decodeSource(Buffer.from(await response.arrayBuffer()));
}

/**
 * Every question the source can give us, before any of the quality filters in
 * `classify` run. Cached, because the twenty-two files are eight megabytes and
 * re-tuning the classification rules should not re-download them.
 */
export async function harvestOpenTriviaQA(cacheOnly = false): Promise<Question[]> {
  const cached = await readFile(SOURCE_CACHE, 'utf8').catch(() => null);
  if (cached) {
    const pool = JSON.parse(cached) as Question[];
    console.log(`OpenTriviaQA: ${pool.length} questions from cache.\n`);
    return pool;
  }

  // `--resort` promises no network, so a missing cache costs the second source
  // rather than quietly spending eight megabytes. Packs still rebuild from the
  // Open Trivia DB half alone, which is what they held before this existed.
  if (cacheOnly) {
    console.warn('OpenTriviaQA: no cache and --resort was given — skipping the second source.\n');
    return [];
  }

  const byId = new Map<string, Question>();
  let damaged = 0;

  console.log(`Downloading ${FILE_CATEGORIES.size} OpenTriviaQA categories.\n`);

  for (const [file, category] of FILE_CATEGORIES) {
    const blocks = parseBlocks(await fetchCategory(file));
    let kept = 0;

    for (const block of blocks) {
      const text = [block.prompt, ...block.options].join(' ');
      if (!isUndamaged(text)) {
        damaged += 1;
        continue;
      }

      // Content-addressed, exactly as the Open Trivia DB harvest is, so a
      // question both sources carry collapses to one entry rather than being
      // asked twice in the same round.
      const id = stableId(block.prompt);
      if (byId.has(id)) continue;

      byId.set(id, {
        id,
        question: block.prompt,
        correct: block.correct,
        incorrect: block.options.filter((option) => option !== block.correct),
        category,
        // The source carries no difficulty and none can be inferred from the
        // text — three heuristics were measured against a hand-labelled sample
        // and none beat labelling everything hard. See docs/decisions/questions.md.
        difficulty: 'medium',
        source: 'opentriviaqa',
      });
      kept += 1;
    }

    console.log(`  ${file.padEnd(20)} ${String(kept).padStart(5)}`);
  }

  const pool = [...byId.values()];
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(SOURCE_CACHE, `${JSON.stringify(pool)}\n`, 'utf8');

  console.log(`\nOpenTriviaQA: ${pool.length} usable, ${damaged} dropped as damaged text.\n`);
  return pool;
}

/**
 * Runnable on its own as `npm run fetch-otqa`, which is how the cache gets
 * filled the first time.
 *
 * It is a separate command because the two sources cost wildly different
 * things: Open Trivia DB is a throttled 25-minute crawl, this is eight
 * megabytes over about twenty seconds. Folding it into `fetch-questions` would
 * mean either breaking the `--resort` promise of no network, or making the only
 * route to a second source a full re-harvest of the first.
 */
if (import.meta.filename === process.argv[1]) {
  harvestOpenTriviaQA()
    .then((pool) => {
      console.log(`Cached ${pool.length} questions. Run \`npm run fetch-questions -- --resort\`.`);
    })
    .catch((error: unknown) => {
      console.error('fetch-otqa failed:', error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}
