/**
 * Fetches public-domain flag rasters and writes `public/packs/flags.json`.
 *
 * Run: `npx tsx scripts/write-flags-pack.ts`
 */

import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { FLAG_SPECS } from './hand-flags-data';
import { writeSealedPack } from './write-sealed-pack';
import {
  compressStill,
  fetchBuffer,
  hashAndStore,
  IMAGE_DIR,
  OUT_DIR,
  replaceMarkdownSection,
  stableId,
} from './write-hand-packs';
import { PACK_META, sealQuestion, type Pack, type Question, type SealedQuestion } from '../src/questions/types';

export const FLAGS_MIN_PACK = 45;
export const FLAGS_ATTR_MARKER = '## Flags';

function flagUrls(code: string): string[] {
  const urls = [`https://flagcdn.com/w640/${code}.png`];
  // Northern Ireland has no official flag. Flagcdn's gb-nir is the Ulster
  // Banner; Commons is the same image if Flagcdn 404s.
  if (code === 'gb-nir') {
    urls.push(
      'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f6/Flag_of_Northern_Ireland.svg/640px-Flag_of_Northern_Ireland.svg.png',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/8/81/Ulster_banner.svg/640px-Ulster_banner.svg.png',
    );
  }
  return urls;
}

async function fetchFlag(code: string): Promise<Buffer> {
  let last: Error | null = null;
  for (const url of flagUrls(code)) {
    try {
      const fetched = await fetchBuffer(url);
      return fetched.bytes;
    } catch (error: unknown) {
      last = error instanceof Error ? error : new Error(String(error));
    }
  }
  throw last ?? new Error(`No raster for flag ${code}`);
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function existingBySlug(): Promise<Map<string, string>> {
  const raw = await readFile(join(OUT_DIR, 'flags.json'), 'utf8').catch(() => null);
  if (!raw) return new Map();
  const pack = JSON.parse(raw) as Pack;
  const byId = new Map(
    pack.questions.flatMap((question) =>
      question.image ? [[question.id, question.image] as const] : [],
    ),
  );
  const found = new Map<string, string>();
  for (const spec of FLAG_SPECS) {
    const image = byId.get(stableId(spec.slug));
    if (!image) continue;
    if (await fileExists(join(IMAGE_DIR, image))) found.set(spec.slug, image);
  }
  return found;
}

function flagsAttributionMarkdown(): string {
  return `${FLAGS_ATTR_MARKER}

Public-domain country flags fetched from [Flagcdn](https://flagcdn.com) (Wikipedia /
Wikimedia rasters) at pack-build and content-hashed into \`images/\`, same as
the stills. England, Scotland, Wales and Northern Ireland use Flagcdn's
\`gb-eng\` / \`gb-sct\` / \`gb-wls\` / \`gb-nir\` codes. Northern Ireland has
no official flag; \`gb-nir\` is the Ulster Banner, used here as the
recognisable quiz image, not as a statement of status.
`;
}

async function writeFlagsAttribution(): Promise<void> {
  const path = join(OUT_DIR, 'ATTRIBUTION.md');
  const existing = await readFile(path, 'utf8');
  await writeFile(path, replaceMarkdownSection(existing, FLAGS_ATTR_MARKER, flagsAttributionMarkdown()));
}

export async function buildFlagsPack(): Promise<{ pack: Pack; answers: Record<string, string> }> {
  await mkdir(IMAGE_DIR, { recursive: true });
  const reused = await existingBySlug();
  const answers: Record<string, string> = {};
  const questions: SealedQuestion[] = [];
  const skipped: string[] = [];

  for (const spec of FLAG_SPECS) {
    process.stdout.write(`  flag ${spec.slug}…`);
    try {
      let filename = reused.get(spec.slug);
      if (filename) {
        console.log(` reuse ${filename}`);
      } else {
        const bytes = await fetchFlag(spec.code);
        const shrunk = await compressStill(bytes, 'png');
        filename = await hashAndStore(shrunk.bytes, shrunk.ext);
        console.log(` ${filename} (${Math.round(shrunk.bytes.length / 1024)} kB)`);
      }
      const question: Question = {
        id: stableId(spec.slug),
        source: 'hand',
        question: spec.prompt,
        correct: spec.correct,
        incorrect: spec.incorrect,
        category: 'Flags',
        difficulty: spec.difficulty,
        image: filename,
      };
      answers[question.id] = spec.correct;
      questions.push(sealQuestion(question));
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : String(error);
      skipped.push(`${spec.slug}: ${reason}`);
      console.log(` skip`);
    }
  }

  if (skipped.length > 0) {
    console.warn(`Skipped ${skipped.length} flags:\n${skipped.join('\n')}`);
  }
  if (questions.length < FLAGS_MIN_PACK) {
    throw new Error(
      `Only ${questions.length} flags resolved (need ${FLAGS_MIN_PACK}). Skipped:\n${skipped.join('\n')}`,
    );
  }

  const meta = PACK_META.flags;
  return { pack: { id: 'flags', title: meta.title, blurb: meta.blurb, questions }, answers };
}

async function main(): Promise<void> {
  console.log('Flags pack');
  const { pack, answers } = await buildFlagsPack();
  await writeSealedPack(pack, answers, 'flags.json');
  await writeFlagsAttribution();
}

const runningDirect = process.argv[1]?.includes('write-flags-pack') === true;
if (runningDirect) {
  main().catch((error: unknown) => {
    console.error('write-flags-pack failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
