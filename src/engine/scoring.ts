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

/**
 * What to tell a player about their own answer, once the question is revealed.
 *
 * `lost` is the one worth having a name for. The other three are what the player
 * already knows; this one is the room disagreeing with what they saw on their own
 * screen, and until it existed nothing said so.
 */
export type Verdict = 'correct' | 'wrong' | 'lost' | 'silent';

export interface VerdictInput {
  /** This player's answer to the question in play, if this device has one. */
  answer: Answer | undefined;
  correctIndex: number | null;
  /** `lastDeltas` from the reveal — every player the question was scored for. */
  deltas: Record<string, number>;
  uid: string | null;
}

/**
 * Reads one player's fortunes off a reveal.
 *
 * The whole point is the `lost` case. An answer is written to a subcollection and
 * the reveal is folded on the quizmaster's device, so there is a gap in which an
 * answer can be perfectly valid — inside the window, on the right question — and
 * still not be in the room when the question is scored. The player sees their
 * lectern light up and their score not move, and nothing connects the two. In
 * room 6JA5 that would have read as **"Correct · +0"**, which is the game calling
 * itself a liar.
 *
 * The test for it is exact rather than a guess: `tallyQuestion` emits an entry
 * for *everyone* whose answer was scored, including a zero for everyone who got
 * it wrong. So a player holding an answer who has no entry at all was not in the
 * tally, and that is the only way it can happen.
 *
 * Call it only once the question is revealed. Before that the deltas belong to
 * the previous question and every answer looks lost.
 */
export function verdictFor({ answer, correctIndex, deltas, uid }: VerdictInput): Verdict {
  if (!uid || !answer) return 'silent';
  if (!Object.hasOwn(deltas, uid)) return 'lost';
  return answer.optionIndex === correctIndex ? 'correct' : 'wrong';
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

/**
 * The standings, less anybody the room no longer lists.
 *
 * `scores` outlives membership on purpose — a player who leaves keeps their
 * score in the map so the numbers still add up if they come back — so ranking
 * the raw map puts people on the board who are not in the room.
 *
 * Written out three separate times before this existed: in `App.tsx`, `Final`
 * and `Standings`. Two of those paint a screen and the third feeds `recordGame`,
 * so a divergence between them would not look like a rendering bug — it would
 * bank a wrong season row and keep it.
 */
export function roomStandings(
  players: Record<string, unknown>,
  scores: Record<string, number>,
): Standing[] {
  return standings(scores).filter((entry) => players[entry.uid]);
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
