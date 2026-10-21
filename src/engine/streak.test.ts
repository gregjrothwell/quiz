import { describe, expect, test } from 'vitest';
import type { QuestionRecord } from './awards';
import { streakOf } from './streak';

/** A question Greg got right (`true`), wrong (`false`), or never answered (`null`). */
function record(index: number, greg: boolean | null): QuestionRecord {
  return {
    index,
    correctIndex: 0,
    answers: greg === null ? {} : { greg: { optionIndex: greg ? 0 : 1, elapsedMs: 2_000 } },
    deltas: greg === null ? {} : { greg: greg ? 900 : 0 },
  };
}

const NONE: ReadonlySet<number> = new Set();

describe('streakOf', () => {
  test('counts the run that ends on the newest question', () => {
    // #given wrong, then three right
    const log = [record(0, false), record(1, true), record(2, true), record(3, true)];

    // #then the run is three, whatever came before it
    expect(streakOf(log, 'greg', NONE)).toBe(3);
  });

  test('is nothing when the newest question was missed', () => {
    const log = [record(0, true), record(1, true), record(2, false)];
    expect(streakOf(log, 'greg', NONE)).toBe(0);
  });

  test('not answering ends a run the same as answering wrong', () => {
    const log = [record(0, true), record(1, null), record(2, true)];
    expect(streakOf(log, 'greg', NONE)).toBe(1);
  });

  test('reads the log by question, not by the order it was written', () => {
    const log = [record(2, true), record(0, false), record(1, true)];
    expect(streakOf(log, 'greg', NONE)).toBe(2);
  });

  test('steps over a question the quizmaster threw out', () => {
    // #given question 1 skipped, so it never reached a reveal or the log
    const log = [record(0, true), record(2, true), record(3, true)];

    // #then it neither breaks the run nor adds to it
    expect(streakOf(log, 'greg', new Set([1]))).toBe(3);
  });

  test('a question this device never saw ends the run', () => {
    // #given question 1 missing and not skipped — a reload before the log was kept, say
    const log = [record(0, true), record(2, true), record(3, true)];

    // #then only what can be vouched for counts
    expect(streakOf(log, 'greg', NONE)).toBe(2);
  });

  test('an answer that never reached the room is not a right answer', () => {
    // #given the right option, but no entry in the tally — `verdictFor`'s "lost"
    const lost: QuestionRecord = {
      index: 1,
      correctIndex: 0,
      answers: { greg: { optionIndex: 0, elapsedMs: 9_000 } },
      deltas: {},
    };
    expect(streakOf([record(0, true), lost], 'greg', NONE)).toBe(0);
  });

  test('is nothing on an empty log', () => {
    expect(streakOf([], 'greg', NONE)).toBe(0);
  });
});
