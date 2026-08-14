import { DEFAULT_QUESTION_DURATION_MS, type Answer } from './state';

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
  durationMs = DEFAULT_QUESTION_DURATION_MS,
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
  /**
   * Passed in rather than read off the question. Until the reveal, no device
   * holds it — the answer comes back from the vault at the moment the question
   * closes, and scoring is the first thing that gets to see it.
   */
  correctIndex: number;
  answers: Record<string, Answer>;
  durationMs?: number;
}): Record<string, number> {
  const { correctIndex, answers, durationMs = DEFAULT_QUESTION_DURATION_MS } = params;
  const deltas: Record<string, number> = {};

  for (const [uid, answer] of Object.entries(answers)) {
    deltas[uid] = scoreAnswer({
      correct: answer.optionIndex === correctIndex,
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

/** How many the podium stands up, and so where the floor begins. */
export const PODIUM_PLACES = 3;

/**
 * Who finished on the lowest score, for the chair at the end of the podium.
 *
 * One condition does all the work: the tie for last has to *start* below the
 * podium. That is what keeps the three edge cases honest, and each of them is a
 * real office round rather than a hypothetical.
 *
 * A round where nobody scored is not a round somebody lost, so a table tied on
 * zero seats no one — the tie starts at the top. A room of three has a third
 * place already standing on a riser, and nobody should be on a riser and in the
 * chair at once. And a tie that reaches up into the podium is the same clash a
 * place lower down: last is only last when everybody above it is genuinely above
 * it.
 *
 * Returns everyone on that score, because a shared last place is still last.
 */
export function seatedLast(rows: readonly Standing[]): string[] {
  const lowest = rows[rows.length - 1]?.score;
  if (lowest === undefined) return [];

  const first = rows.findIndex((row) => row.score === lowest);
  if (first < PODIUM_PLACES) return [];

  return rows.slice(first).map((row) => row.uid);
}
