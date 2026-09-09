/**
 * Resolves untitled TMDB backdrops and writes `public/packs/screens.json`.
 *
 * Stills are hashed onto Pages like flags — TMDB is not a store, so there is
 * no badge grant. Untitled (`iso_639_1 === null`) is the title-free gate.
 *
 * Run: `npm run write-screens-pack` (needs `TMDB_API_KEY` in `.env.local`)
 */

import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { SCREEN_SPECS } from './hand-screens-data';
import { cachedTmdbGet, resolveUntitledBackdrop, type TmdbGet } from './tmdb';
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

export const SCREENS_MIN_PACK = 45;
export const SCREENS_ATTR_MARKER = '## On the box';

export interface ScreensBuildDeps {
  get?: TmdbGet;
  fetchImage?: (url: string) => Promise<{ bytes: Buffer; contentType: string }>;
  store?: (bytes: Buffer, ext: string) => Promise<string>;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function existingBySlug(): Promise<Map<string, { image: string; posterCrop: boolean }>> {
  const raw = await readFile(join(OUT_DIR, 'screens.json'), 'utf8').catch(() => null);
  if (!raw) return new Map();
  const pack = JSON.parse(raw) as Pack;
  const byId = new Map(
    pack.questions.flatMap((question) =>
      question.image
        ? [[question.id, { image: question.image, posterCrop: question.posterCrop === true }] as const]
        : [],
    ),
  );
  const found = new Map<string, { image: string; posterCrop: boolean }>();
  for (const spec of SCREEN_SPECS) {
    const reused = byId.get(stableId(spec.slug));
    if (!reused) continue;
    if (await fileExists(join(IMAGE_DIR, reused.image))) found.set(spec.slug, reused);
  }
  return found;
}

function screensAttributionMarkdown(): string {
  return `${SCREENS_ATTR_MARKER}

Film and TV stills fetched from [TMDB](https://www.themoviedb.org) at pack-build
and content-hashed into \`images/\`, same as the flags. Untitled backdrops only
— a language tag on TMDB is usually titled keyart, which would print the
answer. This product uses the TMDB API but is not endorsed or certified by
TMDB. The stills remain studio copyright; hashing them is a seal, not a licence.
`;
}

async function writeScreensAttribution(): Promise<void> {
  const path = join(OUT_DIR, 'ATTRIBUTION.md');
  const existing = await readFile(path, 'utf8');
  await writeFile(path, replaceMarkdownSection(existing, SCREENS_ATTR_MARKER, screensAttributionMarkdown()));
}

async function storeStill(bytes: Buffer, contentType: string): Promise<string> {
  const ext = contentType.includes('png') ? 'png' : 'jpg';
  const shrunk = await compressStill(bytes, ext);
  return hashAndStore(shrunk.bytes, shrunk.ext);
}

export async function buildScreensPack(
  deps: ScreensBuildDeps = {},
): Promise<{ pack: Pack; answers: Record<string, string> }> {
  await mkdir(IMAGE_DIR, { recursive: true });
  const lookup = deps.get ?? (await cachedTmdbGet());
  const fetchImage = deps.fetchImage ?? fetchBuffer;
  const store = deps.store ?? storeStill;
  const reused = deps.store ? new Map<string, { image: string; posterCrop: boolean }>() : await existingBySlug();
  const answers: Record<string, string> = {};
  const questions: SealedQuestion[] = [];
  const skipped: string[] = [];
  const tmdbIds: number[] = [];

  for (const spec of SCREEN_SPECS) {
    process.stdout.write(`  screen ${spec.slug}…`);
    try {
      let filename = reused.get(spec.slug)?.image;
      let posterCrop = reused.get(spec.slug)?.posterCrop === true;
      if (filename) {
        console.log(` reuse ${filename}`);
      } else {
        const item = await resolveUntitledBackdrop(spec, lookup);
        const fetched = await fetchImage(item.imageUrl);
        filename = await store(fetched.bytes, fetched.contentType);
        posterCrop = item.posterCrop === true;
        tmdbIds.push(item.tmdbId);
        console.log(` ${item.tmdbId} ${filename}`);
      }
      const question: Question = {
        id: stableId(spec.slug),
        source: 'hand',
        question: spec.prompt,
        correct: spec.correct,
        incorrect: spec.incorrect,
        category: spec.kind === 'movie' ? 'Film' : 'Television',
        difficulty: spec.difficulty,
        image: filename,
      };
      if (posterCrop) question.posterCrop = true;
      answers[question.id] = spec.correct;
      questions.push(sealQuestion(question));
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : String(error);
      skipped.push(`${spec.slug}: ${reason}`);
      console.log(` skip`);
    }
  }

  if (skipped.length > 0) {
    console.warn(`Skipped ${skipped.length} screens:\n${skipped.join('\n')}`);
  }
  if (questions.length < SCREENS_MIN_PACK) {
    throw new Error(
      `Only ${questions.length} screens resolved (need ${SCREENS_MIN_PACK}). Skipped:\n${skipped.join('\n')}`,
    );
  }
  const dup = tmdbIds.filter((id, index) => tmdbIds.indexOf(id) !== index);
  if (dup.length > 0) {
    throw new Error(`Two screens resolved to the same title: ${dup.join(', ')}`);
  }

  const meta = PACK_META.screens;
  return { pack: { id: 'screens', title: meta.title, blurb: meta.blurb, questions }, answers };
}

async function main(): Promise<void> {
  console.log('Screens pack (TMDB untitled backdrops, hashed)');
  const { pack, answers } = await buildScreensPack();
  await writeSealedPack(pack, answers, 'screens.json');
  await writeScreensAttribution();
}

const runningDirect = process.argv[1]?.includes('write-screens-pack') === true;
if (runningDirect) {
  main().catch((error: unknown) => {
    console.error('write-screens-pack failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
