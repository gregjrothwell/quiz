import type { QuestionRecord } from '../engine/awards';
import { answeringTimes, leadInMs } from '../engine/leadIn';
import { currentQuestion, type RoomState } from '../engine/state';

/**
 * What this device saw of the question just revealed, for the round's own record
 * (`games/`) and for a Survey Says guess, which reads the room's answer off the
 * telling. Null outside a reveal, and until the answer is on the room.
 *
 * Times are answering times, with the lead-in off, so a fastest finger and a kept
 * round mean the same thing they did before there was one.
 *
 * The rule `useGameLog` keeps in the browser and the Node host keeps in a
 * harness, so both log a round the same way.
 */
export function recordOf(room: RoomState): QuestionRecord | null {
  const question = currentQuestion(room);
  const correctIndex = question?.correctIndex ?? null;
  if (room.phase !== 'reveal' || correctIndex === null) return null;
  return {
    index: room.index,
    correctIndex,
    answers: answeringTimes(room.answers, leadInMs(room)),
    deltas: room.lastDeltas,
    // Survey Says: a tell has no right answer, and a tied guess has several.
    ...(question?.survey?.part === 'tell' ? { tell: true } : {}),
    ...(question?.survey?.top ? { top: question.survey.top } : {}),
  };
}

export interface GameLog {
  gameId: string | null;
  records: QuestionRecord[];
}

/** The log with this reveal added, or the same log when there is nothing new. */
export function logged(log: GameLog, room: RoomState): GameLog {
  const record = recordOf(room);
  if (!record) return log;
  const fresh = log.gameId !== room.gameId;
  if (!fresh && log.records.some((entry) => entry.index === room.index)) return log;
  return { gameId: room.gameId, records: fresh ? [record] : [...log.records, record] };
}
