import { useState } from 'react';
import type { QuestionRecord } from '../engine/awards';
import { currentQuestion, type RoomState } from '../engine/state';

interface Log {
  gameId: string | null;
  records: QuestionRecord[];
}

const NO_RECORDS: QuestionRecord[] = [];

/**
 * Keeps this device's own record of how each question finished.
 *
 * Nothing else does. The answers subcollection holds one document per player and
 * overwrites it every question, and `lastDeltas` only ever describes the last
 * one — so by the final screen the game's record of itself is gone, and awards
 * worked out from it would have nothing to work from.
 *
 * Kept in memory rather than written anywhere. Every client already receives
 * every reveal, so each one can build this for no reads, no writes and no rules
 * change; and because the input is identical on every device, so is the output.
 * The cost is that a reload loses it, which is why the final screen only shows
 * awards for a log covering the whole game — better absent than contradicting
 * the screen next to it.
 *
 * Appended during render rather than from an effect: an effect that sets state
 * is what `react-hooks/set-state-in-effect` exists to catch, and React re-runs
 * the render before committing, so nothing is ever painted from the stale log.
 */
export function useGameLog(room: RoomState | null): QuestionRecord[] {
  const [log, setLog] = useState<Log>({ gameId: null, records: NO_RECORDS });

  const question = room ? currentQuestion(room) : null;
  const correctIndex = question?.correctIndex ?? null;

  if (room && room.phase === 'reveal' && correctIndex !== null) {
    const fresh = log.gameId !== room.gameId;
    const seen = !fresh && log.records.some((entry) => entry.index === room.index);

    if (!seen) {
      const record: QuestionRecord = {
        index: room.index,
        correctIndex,
        answers: room.answers,
        deltas: room.lastDeltas,
      };
      setLog({
        gameId: room.gameId,
        records: fresh ? [record] : [...log.records, record],
      });
    }
  }

  // A log belonging to the previous game in this room is not this game's, and
  // "Another round" reuses the room.
  return log.gameId === (room?.gameId ?? null) ? log.records : NO_RECORDS;
}
