/**
 * Resolves iTunes GB film/TV artwork and writes `public/packs/screens.json`.
 *
 * As of 9 September 2026 the GB Search API returns **zero movies** (`media=movie`
 * and lookup of known US movie ids). TV search is mostly compilations, not
 * seasons. This writer stays; it does not ship a pack until Apple's catalog
 * answers. Posters usually print the title anyway — crop is not a licence.
 *
 * Run: `npx tsx scripts/write-screens-pack.ts`
 */

import { SCREEN_SPECS } from './hand-screens-data';
import { cachedItunesGet, resolveScreen, type ItunesGet } from './itunes';
import { writeSealedPack } from './write-sealed-pack';
import { stableId } from './write-hand-packs';
import { isItunesArtworkUrl } from '../src/lib/apple-media';
import { PACK_META, sealQuestion, type Pack, type Question } from '../src/questions/types';

const SCREENS_MIN_PACK = 45;

export async function buildScreensPack(
  get?: ItunesGet,
): Promise<{ pack: Pack; answers: Record<string, string> }> {
  const lookup = get ?? (await cachedItunesGet());
  const answers: Record<string, string> = {};
  const questions = [];
  const skipped: string[] = [];
  for (const spec of SCREEN_SPECS) {
    process.stdout.write(`  screen ${spec.slug}…`);
    try {
      const item = await resolveScreen(spec.term, spec.kind, lookup, spec.correct);
      if (!isItunesArtworkUrl(item.artworkUrl)) {
        throw new Error(`artwork is not on mzstatic`);
      }
      console.log(` ${item.id}`);
      const question: Question = {
        id: stableId(spec.slug),
        source: 'hand',
        question: spec.prompt,
        correct: spec.correct,
        incorrect: spec.incorrect,
        category: spec.kind === 'movie' ? 'Film' : 'Television',
        difficulty: spec.difficulty,
        artworkUrl: item.artworkUrl,
        storeUrl: item.storeUrl,
        trackId: item.id,
        posterCrop: true,
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
    console.warn(`Skipped ${skipped.length} screens:\n${skipped.join('\n')}`);
  }
  if (questions.length < SCREENS_MIN_PACK) {
    throw new Error(
      `Only ${questions.length} screens resolved (need ${SCREENS_MIN_PACK}). Skipped:\n${skipped.join('\n')}`,
    );
  }
  const ids = questions.map((question) => question.trackId);
  const dup = ids.filter((id, index) => id !== undefined && ids.indexOf(id) !== index);
  if (dup.length > 0) {
    throw new Error(`Two screens resolved to the same item: ${dup.join(', ')}`);
  }
  const meta = PACK_META.screens;
  return { pack: { id: 'screens', title: meta.title, blurb: meta.blurb, questions }, answers };
}

async function main(): Promise<void> {
  console.log('Screens pack (iTunes GB artwork, poster-cropped)');
  const { pack, answers } = await buildScreensPack();
  await writeSealedPack(pack, answers, 'screens.json');
}

const runningDirect = process.argv[1]?.includes('write-screens-pack') === true;
if (runningDirect) {
  main().catch((error: unknown) => {
    console.error('write-screens-pack failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
