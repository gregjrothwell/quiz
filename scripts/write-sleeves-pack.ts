/**
 * Resolves iTunes GB album artwork and writes `public/packs/sleeves.json`.
 *
 * Run: `npx tsx scripts/write-sleeves-pack.ts`
 */

import { SLEEVE_SPECS } from './hand-sleeves-data';
import { SLEEVE_COVER_TEXT } from './sleeve-cover-text';
import { SLEEVE_HAND_REFUSALS } from './sleeve-refusals';
import { sleeveVerdict } from './title-on-cover';
import { cachedItunesGet, resolveAlbum, type ItunesGet } from './itunes';
import { writeSealedPack } from './write-sealed-pack';
import { stableId } from './write-hand-packs';
import { isItunesArtworkUrl } from '../src/lib/apple-media';
import { PACK_META, sealQuestion, type Pack, type Question } from '../src/questions/types';

/**
 * How many sleeves make a pack worth shipping.
 *
 * Was 45, set when the pack was 52 albums and nothing looked at the artwork. It
 * cannot be 45 any more and be honest: of 143 covers audited on 21 September
 * 2026, **103 either name their own album or carry other writing**, and only 40
 * are clean. That is not a shortage of famous albums — it is what album covers
 * are like, and the old 52 met the old bar by publishing 33 that gave the
 * answer away.
 *
 * 36 is two full rounds of fifteen with six spare, against the 19 that were
 * actually playable before. Lengthening `hand-sleeves-data.ts` is how this goes
 * back up; loosening `title-on-cover.ts` is not.
 */
const SLEEVES_MIN_PACK = 36;

export async function buildSleevesPack(
  get?: ItunesGet,
): Promise<{ pack: Pack; answers: Record<string, string> }> {
  const lookup = get ?? (await cachedItunesGet());
  const answers: Record<string, string> = {};
  const questions = [];
  const skipped: string[] = [];
  const refused: string[] = [];
  for (const spec of SLEEVE_SPECS) {
    process.stdout.write(`  sleeve ${spec.slug}…`);
    try {
      /*
        The cover is checked before anything is fetched.

        This is the gate the pack did not have. On 21 September 2026 eleven of
        the fifteen sleeves in round `53FN` had the answer written on the
        picture; all four hard ones that did scored 100%, and the one hard
        question with a wordless cover scored 50%. `sleeve-cover-text.ts` holds
        what Apple's Vision read off each cover and `title-on-cover.ts` decides
        what that means — see `docs/decisions/sleeves-gate.md`.

        A slug with no recorded text has never been audited, and is refused
        rather than trusted: an unaudited cover is exactly the one nobody has
        looked at.
      */
      const cover = SLEEVE_COVER_TEXT[spec.slug];
      if (cover === undefined) {
        throw new Error('no audited cover text — run `npm run sleeve-audit`');
      }
      const byHand = SLEEVE_HAND_REFUSALS[spec.slug];
      if (byHand !== undefined) {
        refused.push(`${spec.slug}: ${byHand} (by eye)`);
        console.log(` refused`);
        continue;
      }
      const verdict = sleeveVerdict(spec.correct, spec.artist, cover);
      if (!verdict.publishable) {
        refused.push(`${spec.slug}: ${verdict.why}`);
        console.log(` refused`);
        continue;
      }

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
  if (refused.length > 0) {
    console.warn(`\nRefused ${refused.length} sleeves whose covers talk:\n${refused.join('\n')}`);
  }
  if (skipped.length > 0) {
    console.warn(`\nSkipped ${skipped.length} sleeves:\n${skipped.join('\n')}`);
  }
  if (questions.length < SLEEVES_MIN_PACK) {
    throw new Error(
      `Only ${questions.length} sleeves resolved (need ${SLEEVES_MIN_PACK}).`
        + ` ${refused.length} refused for what is written on the cover,`
        + ` ${skipped.length} would not resolve.\nSkipped:\n${skipped.join('\n')}`,
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
