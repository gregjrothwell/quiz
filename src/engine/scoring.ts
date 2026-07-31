import { QUESTION_DURATION_MS, type Answer, type QuizQuestion } from './state';

/** Awarded for any correct answer, regardless of speed. */
export const BASE_POINTS = 500;

/** Additional points available for answering quickly, scaled by time left. */
export const SPEED_POINTS = 500;

export interface ScoreInput {
  correct: boolean;
  elapsedMs: number;
  durationMs?: number;
}

/**
 * Speed-weighted scoring, matching what the team already expects from Polly:
 * a correct answer is worth {@link BASE_POINTS}, plus up to {@link SPEED_POINTS}
 * more on a linear decay across the question window. Answering instantly scores
 * 1000; answering as the clock expires still scores 500; wrong scores nothing.
 */
export function scoreAnswer({
  correct,
  elapsedMs,
  durationMs = QUESTION_DURATION_MS,
}: ScoreInput): number {
  if (!correct) return 0;
  if (durationMs <= 0) return BASE_POINTS + SPEED_POINTS;

  const clamped = Math.min(Math.max(elapsedMs, 0), durationMs);
  const remaining = 1 - clamped / durationMs;
  return BASE_POINTS + Math.round(SPEED_POINTS * remaining);
}

/**
 * Points each player earned on one question. Players who did not answer are
 * absent from the result rather than present with zero, so the reveal can tell
 * "got it wrong" apart from "ran out of time".
 */
export function tallyQuestion(params: {
  question: QuizQuestion;
  answers: Record<string, Answer>;
  durationMs?: number;
}): Record<string, number> {
  const { question, answers, durationMs = QUESTION_DURATION_MS } = params;
  const deltas: Record<string, number> = {};

  for (const [uid, answer] of Object.entries(answers)) {
    deltas[uid] = scoreAnswer({
      correct: answer.optionIndex === question.correctIndex,
      elapsedMs: answer.elapsedMs,
      durationMs,
    });
  }

  return deltas;
}

export interface Standing {
  uid: string;
  score: number;
  /** 1-based, with ties sharing a position. */
  position: number;
}

/**
 * Ranks players highest first. Tied scores share a position, and the next
 * distinct score resumes at the count already awarded — so two players on 1000
 * are both 1st and the next is 3rd.
 */
export function standings(scores: Record<string, number>): Standing[] {
  const sorted = Object.entries(scores)
    .map(([uid, score]) => ({ uid, score }))
    .sort((a, b) => (b.score - a.score) || a.uid.localeCompare(b.uid));

  let position = 0;
  let previousScore: number | null = null;

  return sorted.map((entry, i) => {
    if (previousScore === null || entry.score !== previousScore) {
      position = i + 1;
      previousScore = entry.score;
    }
    return { ...entry, position };
  });
}
