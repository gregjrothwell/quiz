/**
 * Writes public/packs/survey.json and its index entry from scripts/survey-prompts.ts.
 *
 *   npm run write-survey-pack
 *
 * No vault and no seeding: a survey prompt has no answer. The pack is sealed
 * the same as every other (`seal.test.ts`), trivially.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PACK_META, type Pack, type PackSummary } from '../src/questions/types';
import { SURVEY_PROMPTS } from './survey-prompts';

const OUT_DIR = join(import.meta.dirname, '..', 'public', 'packs');

export function surveyPack(): Pack {
  const meta = PACK_META.survey;
  return {
    id: 'survey',
    title: meta.title,
    blurb: meta.blurb,
    questions: SURVEY_PROMPTS.map((entry) => ({
      id: entry.id,
      question: entry.prompt,
      options: [...entry.options],
      category: 'Survey Says',
      difficulty: 'medium',
      ordered: true,
    })),
  };
}

async function main(): Promise<void> {
  const pack = surveyPack();
  await writeFile(join(OUT_DIR, 'survey.json'), `${JSON.stringify(pack)}\n`);

  const index = JSON.parse(await readFile(join(OUT_DIR, 'index.json'), 'utf8')) as PackSummary[];
  const entry: PackSummary = {
    id: 'survey',
    title: pack.title,
    blurb: pack.blurb,
    count: pack.questions.length,
    counts: { easy: 0, medium: pack.questions.length, hard: 0 },
  };
  const merged = [...index.filter((summary) => summary.id !== 'survey'), entry];
  await writeFile(join(OUT_DIR, 'index.json'), `${JSON.stringify(merged, null, 2)}\n`);
  console.log(`survey.json: ${pack.questions.length} prompts; index entry written.`);
}

if (process.argv[1]?.includes('write-survey-pack') === true) {
  main().catch((error: unknown) => {
    console.error('write-survey-pack failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
