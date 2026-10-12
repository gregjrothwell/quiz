/**
 * Writes `public/packs/artists.json` — Name the Artist — from the clips Name
 * that Tune already published. No iTunes lookup and no Firebase.
 *
 * Run: `npm run write-artists-pack`
 * Then `npm run seed-vault -- --pack artists` before anything deploys it.
 * Until that seed, the reveal has nothing to open. See
 * docs/decisions/name-the-artist.md.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  ARTIST_PROMPT,
  ARTISTS_MIN_PACK,
  artistPackStats,
  buildArtistDrafts,
  type ClipRef,
} from './artists-core';
import { TUNE_SPECS } from './hand-tunes-data';
import { writeSealedPack } from './write-sealed-pack';
import { PACK_META, sealQuestion, type Pack, type Question } from '../src/questions/types';

const TUNES_PACK = join(import.meta.dirname, '..', 'public', 'packs', 'tunes.json');

export function clipsFromTunes(raw: string): ClipRef[] {
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== 'object' || parsed === null || !('questions' in parsed)) {
    throw new Error('tunes.json has no questions');
  }
  const { questions } = parsed as { questions: unknown };
  if (!Array.isArray(questions)) throw new Error('tunes.json has no questions');

  const clips: ClipRef[] = [];
  for (const row of questions) {
    if (typeof row !== 'object' || row === null) continue;
    const record = row as Record<string, unknown>;
    clips.push({
      id: typeof record.id === 'string' ? record.id : '',
      ...(typeof record.previewUrl === 'string' ? { previewUrl: record.previewUrl } : {}),
      ...(typeof record.storeUrl === 'string' ? { storeUrl: record.storeUrl } : {}),
      ...(typeof record.trackId === 'number' ? { trackId: record.trackId } : {}),
    });
  }
  return clips;
}

export function buildArtistsPack(
  clips: readonly ClipRef[],
): { pack: Pack; answers: Record<string, string> } {
  const { drafts } = buildArtistDrafts(TUNE_SPECS, clips);
  if (drafts.length < ARTISTS_MIN_PACK) {
    throw new Error(`Only ${drafts.length} artist questions (need ${ARTISTS_MIN_PACK})`);
  }

  const answers: Record<string, string> = {};
  const questions = drafts.map((draft) => {
    const question: Question = {
      id: draft.id,
      source: 'hand',
      question: ARTIST_PROMPT,
      correct: draft.artist,
      incorrect: [...draft.incorrect],
      category: 'Name the Artist',
      difficulty: draft.difficulty,
      previewUrl: draft.previewUrl,
      storeUrl: draft.storeUrl,
      trackId: draft.trackId,
    };
    answers[question.id] = draft.artist;
    return sealQuestion(question);
  });

  const meta = PACK_META.artists;
  return { pack: { id: 'artists', title: meta.title, blurb: meta.blurb, questions }, answers };
}

async function main(): Promise<void> {
  const clips = clipsFromTunes(await readFile(TUNES_PACK, 'utf8'));
  const { drafts, unresolved } = buildArtistDrafts(TUNE_SPECS, clips);
  const stats = artistPackStats(drafts);
  console.log(
    `Name the Artist: ${stats.questions} questions `
      + `(${stats.easy} easy, ${stats.medium} medium, ${stats.hard} hard); `
      + `neighbours 3/2/1/0 = ${stats.neighbours.join('/')}; `
      + `${unresolved} tunes had no published clip`,
  );
  const { pack, answers } = buildArtistsPack(clips);
  await writeSealedPack(pack, answers, 'artists.json');
}

const runningDirect = process.argv[1]?.includes('write-artists-pack') === true;
if (runningDirect) {
  main().catch((error: unknown) => {
    console.error('write-artists-pack failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
