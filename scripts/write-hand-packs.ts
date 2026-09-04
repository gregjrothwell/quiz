/**
 * Writes the hand-built picture pack, hashes stills into `public/packs/images/`,
 * and merges picture answers into `.cache/hand-vault.json`.
 *
 * Melody is `scripts/write-melody-pack.ts` — this script does not rewrite
 * `melody.json`. Harvest (`fetch-questions`) must not overwrite either pack.
 *
 * Run: `npx tsx scripts/write-hand-packs.ts`
 */

import { execFile } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile, access, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { STILL_SPECS } from './hand-picture-data';
import type { StillSource } from '../src/questions/stills-source';
import {
  HAND_BUILT_PACK_IDS,
  PACK_META,
  sealQuestion,
  type Difficulty,
  type DifficultyCounts,
  type Pack,
  type PackId,
  type PackSummary,
  type Question,
  type SealedQuestion,
} from '../src/questions/types';

const ROOT = join(import.meta.dirname, '..');
const OUT_DIR = join(ROOT, 'public', 'packs');
const IMAGE_DIR = join(OUT_DIR, 'images');
const CACHE_DIR = join(ROOT, '.cache');
export const HAND_VAULT_CACHE = join(CACHE_DIR, 'hand-vault.json');

const USER_AGENT = 'VibeQuiz/0.1 (https://github.com/gregjrothwell/quiz; pack builder)';
const execFileAsync = promisify(execFile);
/** Pack-build target. Spec costed ~200 kB; jigsaw still needs enough pixels. */
const MAX_STILL_BYTES = 280_000;
const MAX_STILL_EDGE = 1200;

function stableId(slug: string): string {
  return createHash('sha1').update(`hand:${slug}`).digest('hex').slice(0, 12);
}

function countByDifficulty(questions: { difficulty: Difficulty }[]): DifficultyCounts {
  const counts: DifficultyCounts = { easy: 0, medium: 0, hard: 0 };
  for (const question of questions) counts[question.difficulty] += 1;
  return counts;
}

function summaryFor(pack: Pack): PackSummary {
  const jigsawCount = pack.questions.filter((question) => question.jigsaw).length;
  return {
    id: pack.id,
    title: pack.title,
    blurb: pack.blurb,
    count: pack.questions.length,
    counts: countByDifficulty(pack.questions),
    ...(jigsawCount > 0 ? { jigsawCount } : {}),
  };
}

function toQuestion(
  slug: string,
  fields: Omit<Question, 'id' | 'source'>,
): Question {
  return { id: stableId(slug), source: 'hand', ...fields };
}

async function fetchBuffer(url: string): Promise<{ bytes: Buffer; contentType: string }> {
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok) throw new Error(`${response.status} fetching ${url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get('content-type') ?? 'image/jpeg';
  return { bytes, contentType };
}

function extensionFor(contentType: string, fallbackUrl: string): string {
  if (contentType.includes('png')) return 'png';
  if (contentType.includes('webp')) return 'webp';
  if (contentType.includes('jpeg') || contentType.includes('jpg')) return 'jpg';
  const fromUrl = fallbackUrl.match(/\.(jpe?g|png|webp)(?:\?|$)/i);
  return fromUrl?.[1]?.toLowerCase() === 'jpeg' ? 'jpg' : (fromUrl?.[1]?.toLowerCase() ?? 'jpg');
}

async function commonsThumbUrl(file: string): Promise<string> {
  const api =
    'https://commons.wikimedia.org/w/api.php?action=query&titles=' +
    encodeURIComponent(`File:${file}`) +
    '&prop=imageinfo&iiprop=url|mime&iiurlwidth=1280&format=json';
  const data = (await (await fetch(api, { headers: { 'User-Agent': USER_AGENT } })).json()) as {
    query: { pages: Record<string, { imageinfo?: { thumburl?: string; url: string }[] }> };
  };
  const page = Object.values(data.query.pages)[0];
  const info = page?.imageinfo?.[0];
  if (!info) throw new Error(`Commons has no imageinfo for File:${file}`);
  return info.thumburl ?? info.url;
}

async function metImageUrl(objectId: number): Promise<string> {
  const href = `https://collectionapi.metmuseum.org/public/collection/v1/objects/${objectId}`;
  const data = (await (await fetch(href, { headers: { 'User-Agent': USER_AGENT } })).json()) as {
    primaryImageSmall?: string;
    primaryImage?: string;
  };
  const url = data.primaryImage || data.primaryImageSmall;
  if (!url) throw new Error(`Met object ${objectId} has no open image`);
  return url;
}

async function resolveSourceUrl(source: StillSource): Promise<string> {
  if (source.kind === 'url') return source.href;
  if (source.kind === 'met') return metImageUrl(source.objectId);
  return commonsThumbUrl(source.file);
}

async function hashAndStore(bytes: Buffer, ext: string): Promise<string> {
  const hash = createHash('sha256').update(bytes).digest('hex');
  const filename = `${hash}.${ext}`;
  await writeFile(join(IMAGE_DIR, filename), bytes);
  return filename;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function existingImagesBySlug(): Promise<Map<string, string>> {
  const raw = await readFile(join(OUT_DIR, 'picture.json'), 'utf8').catch(() => null);
  if (!raw) return new Map();
  const pack = JSON.parse(raw) as Pack;
  const byId = new Map(
    pack.questions.flatMap((question) =>
      question.image ? [[question.id, question.image] as const] : [],
    ),
  );
  const found = new Map<string, string>();
  for (const spec of STILL_SPECS) {
    const image = byId.get(stableId(spec.slug));
    if (!image) continue;
    if (await fileExists(join(IMAGE_DIR, image))) found.set(spec.slug, image);
  }
  return found;
}

async function compressStill(bytes: Buffer, ext: string): Promise<{ bytes: Buffer; ext: string }> {
  if (bytes.length <= MAX_STILL_BYTES && ext !== 'png') return { bytes, ext };
  const scratch = join(CACHE_DIR, 'still-compress');
  await mkdir(scratch, { recursive: true });
  const token = randomBytes(8).toString('hex');
  const input = join(scratch, `in-${token}.${ext}`);
  const output = join(scratch, `out-${token}.jpg`);
  await writeFile(input, bytes);
  try {
    await execFileAsync('sips', [
      '-Z',
      String(MAX_STILL_EDGE),
      '-s',
      'format',
      'jpeg',
      '-s',
      'formatOptions',
      '70',
      input,
      '--out',
      output,
    ]);
    const compressed = await readFile(output);
    if (compressed.length > 0 && compressed.length < bytes.length) {
      return { bytes: compressed, ext: 'jpg' };
    }
  } catch {
    return { bytes, ext };
  } finally {
    await unlink(input).catch(() => undefined);
    await unlink(output).catch(() => undefined);
  }
  return { bytes, ext };
}

/** Overlay new hand-pack answers without dropping keys the other pack already vaulted. */
export function mergeHandVault(
  existing: Record<string, string>,
  added: Record<string, string>,
): Record<string, string> {
  return { ...existing, ...added };
}

export async function readHandVault(): Promise<Record<string, string>> {
  const raw = await readFile(HAND_VAULT_CACHE, 'utf8').catch(() => null);
  if (!raw) return {};
  return JSON.parse(raw) as Record<string, string>;
}

export async function readHandBuiltSummaries(): Promise<PackSummary[]> {
  const summaries: PackSummary[] = [];
  for (const id of HAND_BUILT_PACK_IDS) {
    const raw = await readFile(join(OUT_DIR, `${id}.json`), 'utf8').catch(() => null);
    if (!raw) continue;
    summaries.push(summaryFor(JSON.parse(raw) as Pack));
  }
  return summaries;
}

export function mergeIndex(harvested: PackSummary[], hand: PackSummary[]): PackSummary[] {
  const skip = new Set<PackId>(HAND_BUILT_PACK_IDS);
  return [...harvested.filter((pack) => !skip.has(pack.id)), ...hand];
}

const STILLS_ATTR_MARKER = '## Picture-round stills';

export function withStillsAttribution(trivia: string, stillsBody: string): string {
  const trimmed = trivia.includes(STILLS_ATTR_MARKER)
    ? trivia.slice(0, trivia.indexOf(STILLS_ATTR_MARKER)).trimEnd()
    : trivia.trimEnd();
  return `${trimmed}\n\n${stillsBody.trim()}\n`;
}

function stillsAttributionMarkdown(): string {
  const lines = STILL_SPECS.map((spec) => `- ${spec.attribution}`);
  return `${STILLS_ATTR_MARKER}

Hand-built stills, hashed into \`images/\` at pack-build so a filename cannot
name the work. PD-Art, CC0 and NASA PD-USGov are recorded here only. CC BY
also appears on-screen.

${lines.join('\n')}
`;
}

async function writePicture(): Promise<{ pack: Pack; answers: Record<string, string> }> {
  await mkdir(IMAGE_DIR, { recursive: true });
  const reused = await existingImagesBySlug();
  const answers: Record<string, string> = {};
  const questions: SealedQuestion[] = [];

  for (const spec of STILL_SPECS) {
    process.stdout.write(`  still ${spec.slug}…`);
    let filename = reused.get(spec.slug);
    if (filename) {
      console.log(` reuse ${filename}`);
    } else {
      const url = await resolveSourceUrl(spec.source);
      const fetched = await fetchBuffer(url);
      const shrunk = await compressStill(fetched.bytes, extensionFor(fetched.contentType, url));
      filename = await hashAndStore(shrunk.bytes, shrunk.ext);
      console.log(` ${filename} (${Math.round(shrunk.bytes.length / 1024)} kB)`);
    }

    const question = toQuestion(spec.slug, {
      question: spec.prompt,
      correct: spec.correct,
      incorrect: spec.incorrect,
      category: 'Picture',
      difficulty: spec.difficulty,
      image: filename,
      ...(spec.credit ? { credit: spec.credit } : {}),
      ...(spec.jigsaw ? { jigsaw: true } : {}),
    });
    answers[question.id] = spec.correct;
    questions.push(sealQuestion(question));
  }

  const meta = PACK_META.picture;
  const pack: Pack = { id: 'picture', title: meta.title, blurb: meta.blurb, questions };
  await writeFile(join(OUT_DIR, 'picture.json'), `${JSON.stringify(pack)}\n`);
  return { pack, answers };
}

async function upsertIndex(hand: PackSummary[]): Promise<void> {
  const raw = await readFile(join(OUT_DIR, 'index.json'), 'utf8');
  const harvested = JSON.parse(raw) as PackSummary[];
  const merged = mergeIndex(harvested, hand);
  await writeFile(join(OUT_DIR, 'index.json'), `${JSON.stringify(merged, null, 2)}\n`);
}

async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });
  await mkdir(CACHE_DIR, { recursive: true });

  console.log('Picture pack (melody.json left as-is)');
  const picture = await writePicture();
  console.log(`  ${picture.pack.questions.length} stills\n`);

  const answers = mergeHandVault(await readHandVault(), picture.answers);
  await writeFile(HAND_VAULT_CACHE, `${JSON.stringify(answers)}\n`);

  await upsertIndex(await readHandBuiltSummaries());

  const trivia = await readFile(join(OUT_DIR, 'ATTRIBUTION.md'), 'utf8');
  await writeFile(join(OUT_DIR, 'ATTRIBUTION.md'), withStillsAttribution(trivia, stillsAttributionMarkdown()));

  console.log(`Vault fragment: ${Object.keys(answers).length} answers → ${HAND_VAULT_CACHE}`);
  console.log('Run `npm run seed-vault` to publish them (merges this fragment).');
}

const runningDirect =
  process.argv[1]?.includes('write-hand-packs') === true;

if (runningDirect) {
  main().catch((error: unknown) => {
    console.error('write-hand-packs failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
