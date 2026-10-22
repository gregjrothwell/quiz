import type { SealedQuestion } from '../questions/types';
import { shuffle, type Answer, type QuizQuestion, type Rng } from './state';

/**
 * Survey Says: the room answers five prompts about itself ("tell us"), then
 * guesses its own most popular answer to each ("we asked the office").
 * docs/decisions/survey-says.md.
 *
 * Everything here is pure. The one thing a survey needs that no other round
 * does — the room's own tally — comes from the host's game log, because each
 * player's answer document is overwritten every question, and since W3 only
 * the host ever reads anybody else's.
 */

export type SurveyPart = 'tell' | 'guess';

export interface SurveyRef {
  part: SurveyPart;
  /** The prompt both parts share, so a guess can find its telling. */
  promptId: string;
  /**
   * Every option tied for most popular, set on the guess at its reveal. Absent
   * until then, and always absent on a tell.
   */
  top?: number[];
}

export const SURVEY_PROMPTS_PER_ROUND = 5;

/** Two answers is not a survey (G3). */
export const SURVEY_MIN_ANSWERS = 3;

export function surveyQuestionId(promptId: string, part: SurveyPart): string {
  return `${promptId}~${part}`;
}

function surveyQuestion(prompt: SealedQuestion, part: SurveyPart): QuizQuestion {
  return {
    id: surveyQuestionId(prompt.id, part),
    prompt: prompt.question,
    // The written order, in both parts. A tally is counted by option index, so
    // shuffling the guess would point the room's answer at the wrong option.
    options: [...prompt.options],
    correctIndex: null,
    category: prompt.category,
    difficulty: prompt.difficulty,
    survey: { part, promptId: prompt.id },
  };
}

/**
 * Five prompts told, then the same five guessed in a different order. Prompts
 * the season has already served go to the back of the queue rather than out of
 * it, so a small pack still deals a full round.
 */
export function dealSurveyRound(
  prompts: readonly SealedQuestion[],
  rng: Rng = Math.random,
  asked: ReadonlySet<string> = new Set(),
  count: number = SURVEY_PROMPTS_PER_ROUND,
): QuizQuestion[] {
  const fresh = shuffle(
    prompts.filter((entry) => !asked.has(entry.id)),
    rng,
  );
  const stale = shuffle(
    prompts.filter((entry) => asked.has(entry.id)),
    rng,
  );
  const chosen = [...fresh, ...stale].slice(0, count);

  let guessed = shuffle(chosen, rng);
  // Told and guessed in the same order would make part two a memory test of
  // part one's sequence. With five that happens one deal in 120; a rotation
  // is the cheapest certain fix.
  if (chosen.length > 1 && guessed.every((entry, index) => entry === chosen[index])) {
    guessed = [...guessed.slice(1), ...guessed.slice(0, 1)];
  }

  return [
    ...chosen.map((entry) => surveyQuestion(entry, 'tell')),
    ...guessed.map((entry) => surveyQuestion(entry, 'guess')),
  ];
}

/** How many picked each option. */
export function tallyTell(answers: Record<string, Answer>, optionCount: number): number[] {
  const counts = Array.from({ length: optionCount }, () => 0);
  for (const { optionIndex } of Object.values(answers)) {
    if (optionIndex >= 0 && optionIndex < optionCount) counts[optionIndex] = (counts[optionIndex] ?? 0) + 1;
  }
  return counts;
}

/** Every option tied for most picked, or null when too few answered. */
export function topOf(counts: readonly number[]): number[] | null {
  const total = counts.reduce((sum, count) => sum + count, 0);
  if (total < SURVEY_MIN_ANSWERS) return null;
  const most = Math.max(...counts);
  return counts.flatMap((count, index) => (count === most ? [index] : []));
}

export function isTell(question: { survey?: SurveyRef }): boolean {
  return question.survey?.part === 'tell';
}

/**
 * Whether a pick is right. One answer on every ordinary question; every tied
 * option on a survey guess; none at all on a tell, which has no right answer.
 *
 * The one place correctness is decided, so a tie cannot be right on one screen
 * and wrong on the next.
 */
export function isPickCorrect(
  question: { correctIndex: number | null; survey?: SurveyRef },
  optionIndex: number,
): boolean {
  if (question.survey?.part === 'tell') return false;
  if (question.survey?.top) return question.survey.top.includes(optionIndex);
  return question.correctIndex !== null && optionIndex === question.correctIndex;
}

/**
 * What the host reveals on a guess: the room's top answer, from its own record
 * of the telling. The lowest tied option stands as `correctIndex` so every
 * reader that knows only one answer still has a valid one; `top` carries them all.
 *
 * Null when there is no telling to read — the chair changed hands, so the new
 * host never saw it (G2a) — or too few answered it (G3). The caller skips.
 */
export function guessReveal(
  questions: readonly QuizQuestion[],
  index: number,
  log: readonly { index: number; answers: Record<string, Answer> }[],
): { correctIndex: number; top: number[] } | null {
  const guess = questions[index];
  if (guess?.survey?.part !== 'guess') return null;

  const { promptId } = guess.survey;
  const tellIndex = questions.findIndex(
    (question) => question.survey?.part === 'tell' && question.survey.promptId === promptId,
  );
  const telling = log.find((record) => record.index === tellIndex);
  if (!telling) return null;

  const top = topOf(tallyTell(telling.answers, guess.options.length));
  if (!top || top[0] === undefined) return null;
  return { correctIndex: top[0], top };
}
