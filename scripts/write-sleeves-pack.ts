/**
 * Resolves iTunes GB album artwork and writes `public/packs/sleeves.json`.
 *
 * Run: `npx tsx scripts/write-sleeves-pack.ts`
 */

import { SLEEVE_SPECS } from './hand-sleeves-data';
import { cachedItunesGet, resolveAlbum, type ItunesGet } from './itunes';
import { writeSealedPack } from './write-sealed-pack';
import { stableId } from './write-hand-packs';
import { isItunesArtworkUrl } from '../src/lib/apple-media';
import { PACK_META, sealQuestion, type Pack, type Question } from '../src/questions/types';

const SLEEVES_MIN_PACK = 45;

export async function buildSleevesPack(
  get?: ItunesGet,
): Promise<{ pack: Pack; answers: Record<string, string> }> {
  const lookup = get ?? (await cachedItunesGet());
  const answers: Record<string, string> = {};
  const questions = [];
  const skipped: string[] = [];
  for (const spec of SLEEVE_SPECS) {
    process.stdout.write(`  sleeve ${spec.slug}…`);
    try {
      const album = await resolveAlbum(spec.term, spec.artist, lookup, spec.correct, spec.collectionId);
      if (!isItunesArtworkUrl(album.artworkUrl)) {
        throw new Error(`artwork is not on mzstatic`);
      }
      console.log(` ${album.id}`);
      const question: Question = {
        id: stableId(spec.slug),
        source: 'hand',
        question: spec.prompt,
        correct: spec.correct,
        incorrect: spec.incorrect,
        category: 'Sleeves',
        difficulty: spec.difficulty,
        artworkUrl: album.artworkUrl,
        storeUrl: album.storeUrl,
        trackId: album.id,
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
    console.warn(`Skipped ${skipped.length} sleeves:\n${skipped.join('\n')}`);
  }
  if (questions.length < SLEEVES_MIN_PACK) {
    throw new Error(
      `Only ${questions.length} sleeves resolved (need ${SLEEVES_MIN_PACK}). Skipped:\n${skipped.join('\n')}`,
    );
  }
  const collectionIds = questions.map((question) => question.trackId);
  const dup = collectionIds.filter(
    (id, index) => id !== undefined && collectionIds.indexOf(id) !== index,
  );
  if (dup.length > 0) {
    throw new Error(`Two sleeves resolved to the same collection: ${dup.join(', ')}`);
  }
  const meta = PACK_META.sleeves;
  return { pack: { id: 'sleeves', title: meta.title, blurb: meta.blurb, questions }, answers };
}

async function main(): Promise<void> {
  console.log('Sleeves pack (iTunes GB artwork)');
  const { pack, answers } = await buildSleevesPack();
  await writeSealedPack(pack, answers, 'sleeves.json');
}

const runningDirect = process.argv[1]?.includes('write-sleeves-pack') === true;
if (runningDirect) {
  main().catch((error: unknown) => {
    console.error('write-sleeves-pack failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
