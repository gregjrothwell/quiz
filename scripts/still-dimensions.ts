/**
 * Reads the pixel size of a hashed still, and writes it into the packs.
 *
 * Run: `npm run still-dimensions` — rewrites every pack under `public/packs/`
 * in place, adding `imageWidth` / `imageHeight` to any question that has an
 * `image`. Ids, hashes and options are untouched: it only ever adds two
 * numbers, so nothing needs reseeding in the vault.
 *
 * Why the packs carry this at all is in `src/questions/types.ts` and
 * `docs/decisions/picture-loading.md`. The short version: without an intrinsic
 * size a not-yet-loaded `<img>` is zero pixels tall, so the picture round shows
 * a gap on a slow connection and reads as broken.
 *
 * The headers are parsed here rather than shelled out to `sips`, which exists
 * only on a Mac. This runs in `npm test`, which has to work offline and on CI.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

export interface Dimensions {
  width: number;
  height: number;
}

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * Start-of-frame markers, which are the ones carrying the size.
 *
 * `0xC4`, `0xC8` and `0xCC` sit in the same numeric range and are not frames —
 * they are the Huffman table, a JPEG extension and the arithmetic-coding table.
 * Reading a size out of one of those gives a confident wrong answer, which is
 * worse than failing.
 */
function isStartOfFrame(marker: number): boolean {
  return marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
}

export function pngDimensions(bytes: Buffer): Dimensions | null {
  if (bytes.length < 24 || !bytes.subarray(0, 8).equals(PNG_MAGIC)) return null;
  if (bytes.subarray(12, 16).toString('latin1') !== 'IHDR') return null;
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

export function jpegDimensions(bytes: Buffer): Dimensions | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let at = 2;
  while (at + 9 < bytes.length) {
    if (bytes[at] !== 0xff) {
      at += 1;
      continue;
    }
    const marker = bytes[at + 1];
    if (marker === undefined) return null;
    // Padding and the standalone markers carry no length word.
    if (marker === 0xff || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
      at += 2;
      continue;
    }
    const length = bytes.readUInt16BE(at + 2);
    if (isStartOfFrame(marker)) {
      return { width: bytes.readUInt16BE(at + 7), height: bytes.readUInt16BE(at + 5) };
    }
    if (length < 2) return null;
    at += 2 + length;
  }
  return null;
}

export function dimensionsOf(bytes: Buffer): Dimensions | null {
  return pngDimensions(bytes) ?? jpegDimensions(bytes);
}

/**
 * Null for a still that is not there as well as for one that cannot be read.
 *
 * Both are the same thing to a caller: a question whose box cannot be worked
 * out. They come back named in `missing` and the builders refuse to write the
 * pack, which is a better failure than a stack trace out of `readFileSync`
 * naming one file and saying nothing about the other fifty-three.
 */
export function dimensionsOfFile(path: string): Dimensions | null {
  let bytes: Buffer;
  try {
    bytes = readFileSync(path);
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null;
    throw error;
  }
  return dimensionsOf(bytes);
}

const PACKS = resolve(import.meta.dirname, '../public/packs');

/**
 * The shape this needs and no more.
 *
 * Structural rather than `SealedQuestion` so it can also be handed a question
 * parsed straight out of a pack file, which is what the in-place rewrite does.
 */
export interface SizedQuestion {
  image?: string | undefined;
  imageWidth?: number | undefined;
  imageHeight?: number | undefined;
}

/**
 * Adds the two numbers to every question in `pack` that has an image.
 *
 * Returns how many it changed, so the caller can say nothing happened rather
 * than rewriting a file identically and calling it work.
 */
export function sizeQuestions(
  questions: SizedQuestion[],
  imageDir: string,
): { sized: number; missing: string[] } {
  let sized = 0;
  const missing: string[] = [];
  for (const question of questions) {
    if (!question.image) continue;
    const found = dimensionsOfFile(join(imageDir, question.image));
    if (found === null) {
      missing.push(question.image);
      continue;
    }
    if (question.imageWidth === found.width && question.imageHeight === found.height) continue;
    question.imageWidth = found.width;
    question.imageHeight = found.height;
    sized += 1;
  }
  return { sized, missing };
}

function main(): void {
  const files = readdirSync(PACKS).filter((name) => name.endsWith('.json') && name !== 'index.json');
  let total = 0;
  const allMissing: string[] = [];
  for (const file of files) {
    const path = join(PACKS, file);
    const pack = JSON.parse(readFileSync(path, 'utf8')) as { questions: SizedQuestion[] };
    const withImages = pack.questions.filter((question) => question.image).length;
    if (withImages === 0) continue;
    const { sized, missing } = sizeQuestions(pack.questions, join(PACKS, 'images'));
    allMissing.push(...missing);
    total += sized;
    if (sized > 0) writeFileSync(path, `${JSON.stringify(pack)}\n`);
    console.log(`  ${file}: ${sized} sized of ${withImages} with an image`);
  }
  if (allMissing.length > 0) {
    console.error(`\nCould not read ${allMissing.length} image(s):\n  ${allMissing.join('\n  ')}`);
    process.exitCode = 1;
  }
  console.log(`\n${total} question(s) gained a size.`);
}

const runningDirect = process.argv[1]?.includes('still-dimensions') === true;
if (runningDirect) main();
