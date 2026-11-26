import { describe, expect, test } from 'vitest';
import { recordOf } from '../host/gameLog';
import { awardsFor } from './awards';
import { foldGameRecord } from './gameRecord';
import {
  answeringMs,
  answeringSecs,
  answeringTimes,
  LEAD_IN_SECS,
  leadInMs,
  leadInOver,
  leadInSecsFor,
  openRound,
  sinceAnswersLanded,
} from './leadIn';
import { optionsAtMs } from './optionsHold';
import { reduce } from './reducer';
import { createRoom, questionDurationMs, type Answer, type QuizQuestion, type RoomState } from './state';

const question = (id: string): QuizQuestion => ({
  id,
  prompt: 'Which?',
  options: ['A', 'B', 'C', 'D'],
  correctIndex: null,
  category: 'General',
  difficulty: 'medium',
});

function lobby(packId: RoomState['packId'] = 'general-knowledge'): RoomState {
  return {
    ...createRoom('HKQ7'),
    packId,
    packTitle: 'Pack',
    players: { greg: { name: 'Greg', joinedAt: 1 }, ann: { name: 'Ann', joinedAt: 2 } },
    questions: [question('q1'), question('q2')],
  };
}

const opened = (packId: RoomState['packId'], durationSecs = 10): RoomState =>
  reduce(lobby(packId), openRound({ packId, at: 1_000, gameId: 'g1', durationSecs }));

describe('opening a round', () => {
  test('adds the lead-in to the window the quizmaster chose (AC3)', () => {
    const room = opened('general-knowledge', 15);
    expect(LEAD_IN_SECS).toBe(2);
    expect(room.durationSecs).toBe(17);
    expect(room.leadInSecs).toBe(2);
    expect(answeringSecs(room)).toBe(15);
    expect(answeringMs(room)).toBe(15_000);
  });

  test('the window the rules and the vault read is the whole of it', () => {
    expect(questionDurationMs(opened('general-knowledge', 10))).toBe(12_000);
  });

  test('a Catchphrase round has none: its picture already plays alone', () => {
    expect(leadInSecsFor('catchphrase')).toBe(0);
    const room = opened('catchphrase', 10);
    expect(room.durationSecs).toBe(10);
    expect(leadInMs(room)).toBe(0);
  });

  test('a round after one with a lead-in does not inherit it', () => {
    const second = reduce(
      { ...lobby('catchphrase'), durationSecs: 12, leadInSecs: 2 },
      openRound({ packId: 'catchphrase', at: 9_000, gameId: 'g2', durationSecs: 10 }),
    );
    expect([second.durationSecs, second.leadInSecs]).toEqual([10, 0]);
  });

  test('a start that names no lead-in has none, as an old bundle starts one', () => {
    const room = reduce(lobby(), { type: 'start', at: 1, gameId: 'g', durationSecs: 10 });
    expect([room.durationSecs, room.leadInSecs]).toEqual([10, 0]);
  });

  test('the next question keeps the window', () => {
    let room = opened('general-knowledge', 10);
    room = reduce(room, { type: 'reveal', correctIndex: 1, questionId: 'q1' });
    room = reduce(room, { type: 'next', at: 2_000 });
    expect([room.phase, room.index, room.durationSecs, room.leadInSecs]).toEqual(['question', 1, 12, 2]);
  });

  test('refuses a window the rules would refuse once the lead-in is on it', () => {
    const start = { type: 'start' as const, at: 1, gameId: 'g', durationSecs: 119, leadInSecs: 2 };
    expect(reduce(lobby(), start).phase).toBe('lobby');
    expect(reduce(lobby(), { ...start, durationSecs: 10, leadInSecs: 0.5 }).phase).toBe('lobby');
    expect(reduce(lobby(), { ...start, durationSecs: 10, leadInSecs: -2 }).phase).toBe('lobby');
  });
});

describe('a room from before the lead-in', () => {
  test('has none, and one that says nonsense has none', () => {
    const room = { ...lobby(), durationSecs: 10 };
    expect(leadInMs({ ...room, leadInSecs: 0 })).toBe(0);
    expect(leadInMs({ ...room, leadInSecs: 10 })).toBe(0);
    expect(leadInMs({ ...room, leadInSecs: -1 })).toBe(0);
    expect(leadInMs({ ...room, leadInSecs: Number.NaN })).toBe(0);
    expect(answeringMs({ ...room, leadInSecs: 10 })).toBe(10_000);
  });
});

describe('the answering clock', () => {
  test('is nothing until the answers land, then counts from there', () => {
    expect(leadInOver(1_999, 2_000)).toBe(false);
    expect(leadInOver(2_000, 2_000)).toBe(true);
    expect(leadInOver(0, 0)).toBe(true);
    expect(sinceAnswersLanded(500, 2_000)).toBe(0);
    expect(sinceAnswersLanded(3_400, 2_000)).toBe(1_400);
  });

  test('a Catchphrase inside a Random Round holds for half the answering time, after the lead-in', () => {
    expect(optionsAtMs('catchphrase', 0, 10_000, 2_000)).toBe(7_000);
    expect(optionsAtMs('catchphrase', 0, 10_000)).toBe(5_000);
    // Not a hold of its own: a tap cannot land before the lead-in anywhere, and
    // a hold above zero is what puts the call box on screen.
    expect(optionsAtMs('screens', 0, 10_000, 2_000)).toBe(0);
    expect(optionsAtMs('catchphrase', 4, 10_000, 2_000)).toBe(0);
  });

  test('takes the lead-in off every time, and never below zero', () => {
    const raw: Record<string, Answer> = {
      greg: { optionIndex: 1, elapsedMs: 3_400, firstMs: 2_600, wager: 50, at: 99 },
      early: { optionIndex: 1, elapsedMs: 900 },
    };
    expect(answeringTimes(raw, 2_000)).toEqual({
      greg: { optionIndex: 1, elapsedMs: 1_400, firstMs: 600, wager: 50, at: 99 },
      early: { optionIndex: 1, elapsedMs: 0 },
    });
    expect(answeringTimes(raw, 0)).toBe(raw);
  });
});

describe('rank (AC7)', () => {
  test('the same taps score the same with and without a lead-in', () => {
    const score = (room: RoomState, shiftMs: number): Record<string, number> => {
      let next = reduce(room, { type: 'answer', uid: 'ann', optionIndex: 1, elapsedMs: 1_200 + shiftMs });
      next = reduce(next, { type: 'answer', uid: 'greg', optionIndex: 1, elapsedMs: 3_400 + shiftMs });
      return reduce(next, { type: 'reveal', correctIndex: 1, questionId: 'q1' }).lastDeltas;
    };
    const plain = reduce(lobby(), { type: 'start', at: 1_000, gameId: 'g1', durationSecs: 10 });
    expect(score(opened('general-knowledge'), 2_000)).toEqual(score(plain, 0));
  });

  test('an answer on the last instant of the answering time still counts', () => {
    const room = reduce(opened('general-knowledge'), { type: 'answer', uid: 'ann', optionIndex: 1, elapsedMs: 12_000 });
    expect(room.answers.ann?.elapsedMs).toBe(12_000);
    expect(reduce(room, { type: 'answer', uid: 'greg', optionIndex: 1, elapsedMs: 12_001 }).answers.greg).toBeUndefined();
  });

  test('the tie-break counts answering time, so two halves with different lead-ins add up fairly', () => {
    let room = reduce(opened('general-knowledge'), { type: 'answer', uid: 'ann', optionIndex: 1, elapsedMs: 3_200 });
    room = reduce(room, { type: 'reveal', correctIndex: 1, questionId: 'q1' });
    expect(room.rightAnswers).toEqual({ ann: { right: 1, ms: 1_200 } });

    // A second one, thrown out after its reveal, comes off exactly as it went on.
    room = reduce(room, { type: 'next', at: 2_000 });
    room = reduce(room, { type: 'answer', uid: 'ann', optionIndex: 1, elapsedMs: 4_000 });
    room = reduce(room, { type: 'reveal', correctIndex: 1, questionId: 'q2' });
    expect(room.rightAnswers).toEqual({ ann: { right: 2, ms: 3_200 } });
    expect(reduce(room, { type: 'skip' }).rightAnswers).toEqual({ ann: { right: 1, ms: 1_200 } });
  });
});

describe('what is kept and shown (AC8)', () => {
  function played(): RoomState {
    let room = opened('general-knowledge', 10);
    room = { ...room, questions: [question('q1')] };
    room = reduce(room, { type: 'answer', uid: 'ann', optionIndex: 1, elapsedMs: 3_200 });
    return reduce(room, { type: 'reveal', correctIndex: 1, questionId: 'q1' });
  }

  test('the device log, the fastest finger and the kept round are in answering time', () => {
    const revealed = played();
    const record = recordOf(revealed);
    if (!record) throw new Error('expected a record');
    expect(record.answers.ann?.elapsedMs).toBe(1_200);

    const fastest = awardsFor([record], ['greg', 'ann']).find((award) => award.id === 'fastest');
    expect(fastest).toMatchObject({ uids: ['ann'], elapsedMs: 1_200 });

    const kept = foldGameRecord({ ...revealed, phase: 'finished' }, [record], 'greg');
    expect(kept?.durationSecs).toBe(10);
    expect(kept?.questions[0]?.answers.ann?.elapsedMs).toBe(1_200);
  });

  test('the answer on the room stays as it was stamped, which is what the rules check', () => {
    expect(played().lastPicks.ann?.elapsedMs).toBe(3_200);
  });
});
