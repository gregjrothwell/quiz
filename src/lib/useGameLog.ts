import { useEffect, useState } from 'react';
import type { QuestionRecord } from '../engine/awards';
import { currentQuestion, type Answer, type RoomState } from '../engine/state';

interface Log {
  gameId: string | null;
  records: QuestionRecord[];
}

const NO_RECORDS: QuestionRecord[] = [];
const EMPTY: Log = { gameId: null, records: NO_RECORDS };

/**
 * Session storage rather than local: the log describes the game this tab is in
 * the middle of, so it should survive a reload and not outlive the tab. Local
 * storage would accumulate a finished game's log on every device forever, for
 * something no later visit can use.
 */
const STORAGE_KEY = 'vibequiz.log';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseAnswer(value: unknown): Answer | null {
  if (!isObject(value)) return null;
  const { optionIndex, elapsedMs } = value;
  if (typeof optionIndex !== 'number' || typeof elapsedMs !== 'number') return null;
  return { optionIndex, elapsedMs };
}

function parseAnswers(value: unknown): Record<string, Answer> {
  if (!isObject(value)) return {};

  const answers: Record<string, Answer> = {};
  for (const [uid, entry] of Object.entries(value)) {
    const answer = parseAnswer(entry);
    if (answer) answers[uid] = answer;
  }
  return answers;
}

function parseDeltas(value: unknown): Record<string, number> {
  if (!isObject(value)) return {};

  const deltas: Record<string, number> = {};
  for (const [uid, entry] of Object.entries(value)) {
    if (typeof entry === 'number') deltas[uid] = entry;
  }
  return deltas;
}

function parseRecord(value: unknown): QuestionRecord | null {
  if (!isObject(value)) return null;
  const { index, correctIndex } = value;
  if (typeof index !== 'number' || typeof correctIndex !== 'number') return null;

  return {
    index,
    correctIndex,
    answers: parseAnswers(value.answers),
    deltas: parseDeltas(value.deltas),
  };
}

/**
 * What is in storage is whatever an earlier build wrote there, or whatever a
 * bored player with the console open decided to put there instead — the same
 * reasoning as `cleanName` in rememberedName.ts, and the same answer: validate
 * on the way out, not just on the way in.
 *
 * A record that will not parse is dropped rather than repaired, which shortens
 * the log and so withholds the awards. That is the safe direction: the final
 * screen already shows nothing rather than something it cannot stand behind.
 */
export function parseLog(raw: string | null): Log {
  if (!raw) return EMPTY;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isObject(parsed)) return EMPTY;

    const { gameId, records } = parsed;
    if (typeof gameId !== 'string' || !Array.isArray(records)) return EMPTY;

    return {
      gameId,
      records: records
        .map(parseRecord)
        .filter((record): record is QuestionRecord => record !== null),
    };
  } catch {
    return EMPTY;
  }
}

function storedLog(): Log {
  try {
    return parseLog(window.sessionStorage.getItem(STORAGE_KEY));
  } catch {
    // Private windows and locked-down profiles throw on access, which simply
    // puts this device back where every device was before it was written.
    return EMPTY;
  }
}

function storeLog(log: Log): void {
  if (!log.gameId) return;

  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(log));
  } catch {
    // Nothing is lost that was not already lost. A device that cannot write here
    // behaves exactly as every device did before this existed: it keeps the log
    // in memory and forgets it on reload.
  }
}

/**
 * Keeps this device's own record of how each question finished.
 *
 * Nothing else does. The answers subcollection holds one document per player and
 * overwrites it every question, and `lastDeltas` only ever describes the last
 * one — so by the final screen the game's record of itself is gone, and awards
 * worked out from it would have nothing to work from.
 *
 * Built on this device rather than fetched. Every client already receives every
 * reveal, so each one can assemble this for no reads, no writes and no rules
 * change; and because the input is identical on every device, so is the output.
 *
 * Mirrored into session storage so a reload does not lose it. That mattered
 * little while the awards were decoration on one screen — better absent than
 * contradicting the screen next to it — and matters a great deal now the same
 * log feeds what gets banked against a season.
 *
 * Appended during render rather than from an effect: an effect that sets state
 * is what `react-hooks/set-state-in-effect` exists to catch, and React re-runs
 * the render before committing, so nothing is ever painted from the stale log.
 * The mirror below *is* an effect, which is allowed because writing to storage
 * is a side effect and not a state update.
 */
export function useGameLog(room: RoomState | null): QuestionRecord[] {
  const [log, setLog] = useState<Log>(storedLog);

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

  useEffect(() => {
    storeLog(log);
  }, [log]);

  // A log belonging to the previous game in this room is not this game's, and
  // "Another round" reuses the room. This is also what makes the hydrated log
  // safe: a stored game that is not the one on screen is simply not this one.
  return log.gameId === (room?.gameId ?? null) ? log.records : NO_RECORDS;
}
