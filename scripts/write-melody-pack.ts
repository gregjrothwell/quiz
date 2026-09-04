/**
 * Writes the sealed melody pack and merges its answers into
 * `.cache/hand-vault.json` without touching picture stills or ATTRIBUTION.md.
 *
 * Picture generation stays in `scripts/write-hand-packs.ts`.
 *
 * Run: `npx tsx scripts/write-melody-pack.ts`
 */

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  MELODY_PACK_BLURB,
  MELODY_PACK_TITLE,
  MELODY_SPECS,
} from './hand-melody-data';
import { HAND_VAULT_CACHE, readHandVault } from './write-hand-packs';
import {
  sealQuestion,
  type Difficulty,
  type DifficultyCounts,
  type Pack,
  type PackSummary,
  type Question,
} from '../src/questions/types';

const ROOT = join(import.meta.dirname, '..');
const OUT_DIR = join(ROOT, 'public', 'packs');
const CACHE_DIR = join(ROOT, '.cache');

function stableId(slug: string): string {
  return createHash('sha1').update(`hand:${slug}`).digest('hex').slice(0, 12);
}

function countByDifficulty(questions: { difficulty: Difficulty }[]): DifficultyCounts {
  const counts: DifficultyCounts = { easy: 0, medium: 0, hard: 0 };
  for (const question of questions) counts[question.difficulty] += 1;
  return counts;
}

export function summaryForMelody(pack: Pack): PackSummary {
  return {
    id: pack.id,
    title: pack.title,
    blurb: pack.blurb,
    count: pack.questions.length,
    counts: countByDifficulty(pack.questions),
  };
}

function toQuestion(slug: string, fields: Omit<Question, 'id' | 'source'>): Question {
  return { id: stableId(slug), source: 'hand', ...fields };
}

/** Picture answers stay; current melody ids overwrite; retired melody ids go. */
export function mergeMelodyVault(
  previous: Record<string, string>,
  melodyAnswers: Record<string, string>,
  retiredIds: readonly string[] = [],
): Record<string, string> {
  const merged = { ...previous, ...melodyAnswers };
  for (const id of retiredIds) {
    if (!(id in melodyAnswers)) delete merged[id];
  }
  return merged;
}

/** Slugs removed in the 4 September taste pass. Vault keys for these ids only. */
export const RETIRED_MELODY_SLUGS = [
  'early-one-morning',
  'british-grenadiers',
  'aquarium',
  'minute-waltz',
  'habanera',
  'la-donna-e-mobile',
  'rondo-alla-turca',
  'bach-air',
] as const;

/** Replace the melody row in place; leave every other pack, including picture, alone. */
export function upsertMelodySummary(index: PackSummary[], melody: PackSummary): PackSummary[] {
  const i = index.findIndex((pack) => pack.id === 'melody');
  if (i === -1) return [...index, melody];
  return index.map((pack, idx) => (idx === i ? melody : pack));
}

export function buildMelodyPack(): { pack: Pack; answers: Record<string, string> } {
  const answers: Record<string, string> = {};
  const questions = MELODY_SPECS.map((spec) => {
    const question = toQuestion(spec.slug, {
      question: spec.prompt,
      correct: spec.correct,
      incorrect: spec.incorrect,
      category: 'Melody',
      difficulty: spec.difficulty,
      voices: spec.voices,
    });
    answers[question.id] = spec.correct;
    return sealQuestion(question);
  });
  const pack: Pack = {
    id: 'melody',
    title: MELODY_PACK_TITLE,
    blurb: MELODY_PACK_BLURB,
    questions,
  };
  return { pack, answers };
}

async function writeMelodyFiles(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });
  await mkdir(CACHE_DIR, { recursive: true });

  const { pack, answers } = buildMelodyPack();
  await writeFile(join(OUT_DIR, 'melody.json'), `${JSON.stringify(pack)}\n`);

  const previous = await readHandVault();
  const retiredIds = RETIRED_MELODY_SLUGS.map(stableId);
  const merged = mergeMelodyVault(previous, answers, retiredIds);
  await writeFile(HAND_VAULT_CACHE, `${JSON.stringify(merged)}\n`);

  const raw = await readFile(join(OUT_DIR, 'index.json'), 'utf8');
  const index = JSON.parse(raw) as PackSummary[];
  const next = upsertMelodySummary(index, summaryForMelody(pack));
  await writeFile(join(OUT_DIR, 'index.json'), `${JSON.stringify(next, null, 2)}\n`);

  console.log(`Melody pack: ${pack.questions.length} tunes → public/packs/melody.json`);
  console.log(`Vault fragment: ${Object.keys(merged).length} answers → ${HAND_VAULT_CACHE}`);
}

const runningDirect = process.argv[1]?.includes('write-melody-pack') === true;

if (runningDirect) {
  writeMelodyFiles().catch((error: unknown) => {
    console.error('write-melody-pack failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
