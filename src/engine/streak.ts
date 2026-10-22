import type { QuestionRecord } from './awards';
import { verdictFor } from './scoring';
import type { RoomState } from './state';

/** Where a run starts being worth saying out loud. Two right is a coincidence. */
export const STREAK_SHOWN_FROM = 3;

/**
 * How many questions in a row `uid` has got right, ending at the newest one in
 * the log.
 *
 * Read off the game log, which every device keeps of what it saw and which
 * survives a reload, rather than off anything stored on the room — a streak is
 * a thing said to one player about themselves, so the device in their hand is
 * the right authority and no write is needed for it.
 *
 * A question the quizmaster threw out never scored anybody, so it neither
 * extends a run nor breaks one: `skipped` is the indices to step over. Any
 * other gap — a question this device never saw — ends the run, because a run
 * nobody can vouch for is not one.
 *
 * "Right" is `verdictFor`'s correct, so an answer that never reached the room
 * in time does not count, exactly as it did not score.
 */
export function streakOf(log: readonly QuestionRecord[], uid: string, skipped: ReadonlySet<number>): number {
  const newestFirst = [...log].sort((a, b) => b.index - a.index);
  let run = 0;
  let expected: number | null = null;

  for (const record of newestFirst) {
    if (expected !== null) {
      while (expected > record.index && skipped.has(expected)) expected -= 1;
      if (record.index !== expected) break;
    }

    const verdict = verdictFor({
      answer: record.answers[uid],
      correctIndex: record.correctIndex,
      deltas: record.deltas,
      uid,
      ...(record.top ? { top: record.top } : {}),
    });
    if (verdict !== 'correct') break;

    run += 1;
    expected = record.index - 1;
  }

  return run;
}

/** The positions of the questions the quizmaster threw out, for `streakOf`. */
export function skippedIndices(room: Pick<RoomState, 'skipped' | 'questions'>): Set<number> {
  const thrownOut = new Set(room.skipped);
  const indices = new Set<number>();
  room.questions.forEach((question, index) => {
    if (thrownOut.has(question.id)) indices.add(index);
  });
  return indices;
}
