/**
 * Resolves iTunes GB previews and writes `public/packs/tunes.json`.
 *
 * Live lookups are rate-limited (~20/min). Tests inject {@link ItunesGet}.
 *
 * Run: `npx tsx scripts/write-tunes-pack.ts`
 */

import { TUNE_SPECS, TUNES_MIN_PACK } from './hand-tunes-data';
import { cachedItunesGet, resolveSong, titleMatches, type ItunesGet } from './itunes';
import { writeSealedPack } from './write-sealed-pack';
import { stableId } from './write-hand-packs';
import { isItunesPreviewUrl } from '../src/lib/apple-media';
import { PACK_META, sealQuestion, type Pack, type Question } from '../src/questions/types';

export async function buildTunesPack(
  get?: ItunesGet,
): Promise<{ pack: Pack; answers: Record<string, string> }> {
  const lookup = get ?? (await cachedItunesGet());
  const answers: Record<string, string> = {};
  const questions = [];
  const skipped: string[] = [];
  const loose: string[] = [];
  for (const spec of TUNE_SPECS) {
    process.stdout.write(`  tune ${spec.slug}…`);
    try {
      const song = await resolveSong(spec.term, spec.artist, lookup, spec.correct);
      if (!isItunesPreviewUrl(song.previewUrl)) {
        throw new Error(`preview is not on Apple’s audio CDN`);
      }
      // Said out loud rather than swallowed: the fallback is Apple's top hit by
      // that artist, which on a prolific one is a different song entirely. The
      // pack still builds — the clip may well be right and Apple's spelling
      // different — but a wrong tune is invisible until somebody plays it.
      if (!titleMatches(song.trackName, spec.correct)) {
        loose.push(`${spec.slug}: wanted “${spec.correct}”, Apple returned “${song.trackName}”`);
      }
      console.log(` ${song.trackId}`);
      const question: Question = {
        id: stableId(spec.slug),
        source: 'hand',
        question: spec.prompt,
        correct: spec.correct,
        incorrect: spec.incorrect,
        category: 'Name that Tune',
        difficulty: spec.difficulty,
        previewUrl: song.previewUrl,
        storeUrl: song.storeUrl,
        trackId: song.trackId,
        ...(spec.previewStart && spec.previewStart > 0 ? { previewStart: spec.previewStart } : {}),
        ...(spec.previewSeconds && spec.previewSeconds > 0
          ? { previewSeconds: spec.previewSeconds }
          : {}),
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
    console.warn(`Skipped ${skipped.length} tunes:\n${skipped.join('\n')}`);
  }
  if (loose.length > 0) {
    console.warn(`Title did not match on ${loose.length} tunes — listen before shipping:\n${loose.join('\n')}`);
  }
  if (questions.length < TUNES_MIN_PACK) {
    throw new Error(
      `Only ${questions.length} tunes resolved (need ${TUNES_MIN_PACK}). Skipped:\n${skipped.join('\n')}`,
    );
  }
  const meta = PACK_META.tunes;
  return { pack: { id: 'tunes', title: meta.title, blurb: meta.blurb, questions }, answers };
}

async function main(): Promise<void> {
  console.log('Tunes pack (iTunes GB previews)');
  const { pack, answers } = await buildTunesPack();
  await writeSealedPack(pack, answers, 'tunes.json');
}

const runningDirect = process.argv[1]?.includes('write-tunes-pack') === true;
if (runningDirect) {
  main().catch((error: unknown) => {
    console.error('write-tunes-pack failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
