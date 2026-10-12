/**
 * Writes `public/packs/blanks.json` — Blankety Blank — and merges its answers
 * into `.cache/hand-vault.json` for `seed-vault`.
 *
 * Run: `npm run write-blanks-pack`, after `npm run blanks-check` has passed.
 * Then `npm run seed-vault -- --pack blanks` before anything deploys it. See
 * docs/decisions/blankety-blank.md.
 */

import { blankedQuestion, type BlankKind } from './blanks-core';
import { BLANK_SPECS, BLANKS_MIN_PACK } from './hand-blanks-data';
import { stableId } from './write-hand-packs';
import { writeSealedPack } from './write-sealed-pack';
import { PACK_META, sealQuestion, type Pack, type Question } from '../src/questions/types';

/** The chip on the question, so the room knows which kind of phrase it is completing. */
const CATEGORY: Record<BlankKind, string> = {
  saying: 'Saying',
  slogan: 'Ad slogan',
  catchphrase: 'TV catchphrase',
};

export function buildBlanksPack(): { pack: Pack; answers: Record<string, string> } {
  if (BLANK_SPECS.length < BLANKS_MIN_PACK) {
    throw new Error(`Only ${BLANK_SPECS.length} specs (need ${BLANKS_MIN_PACK})`);
  }
  const answers: Record<string, string> = {};
  const questions = BLANK_SPECS.map((spec) => {
    const question: Question = {
      id: stableId(spec.slug),
      source: 'hand',
      question: blankedQuestion(spec),
      correct: spec.answer,
      incorrect: spec.incorrect,
      category: CATEGORY[spec.kind],
      difficulty: spec.difficulty,
    };
    answers[question.id] = spec.answer;
    return sealQuestion(question);
  });

  const meta = PACK_META.blanks;
  return { pack: { id: 'blanks', title: meta.title, blurb: meta.blurb, questions }, answers };
}

async function main(): Promise<void> {
  const { pack, answers } = buildBlanksPack();
  await writeSealedPack(pack, answers, 'blanks.json');
}

const runningDirect = process.argv[1]?.includes('write-blanks-pack') === true;
if (runningDirect) {
  main().catch((error: unknown) => {
    console.error('write-blanks-pack failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
