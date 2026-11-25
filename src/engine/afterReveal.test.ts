import { describe, expect, test } from 'vitest';
import { afterReveal, TABLE_EVERY } from './afterReveal';
import { reduce } from './reducer';
import { createRoom, type QuizQuestion, type RoomState } from './state';

/**
 * Where a reveal leads (PROJ-182): the next question, the table at a break, or
 * the results. The reducer and every button naming the next step read the one
 * answer, so each case is asked of both.
 */

const question = (id: string, survey?: 'tell' | 'guess'): QuizQuestion => ({
  id,
  prompt: id,
  options: ['a', 'b'],
  correctIndex: 0,
  category: 'c',
  difficulty: 'easy',
  ...(survey ? { survey: { part: survey, promptId: 'p' } } : {}),
});

const PLAYERS = { ann: { name: 'Ann', joinedAt: 1 }, bob: { name: 'Bob', joinedAt: 2 } };

function reveal(index: number, count: number, overrides: Partial<RoomState> = {}): RoomState {
  return {
    ...createRoom('HKQ7'),
    phase: 'reveal',
    gameId: 'g1',
    index,
    questions: Array.from({ length: count }, (_, i) => question(`q${i + 1}`)),
    players: PLAYERS,
    scores: { ann: 3_000, bob: 1_000 },
    lastDeltas: { ann: 1_000 },
    lastPicks: { ann: { optionIndex: 0, elapsedMs: 1_200 } },
    answers: { ann: { optionIndex: 0, elapsedMs: 1_200 } },
    ...overrides,
  };
}

const press = (room: RoomState): RoomState => reduce(room, { type: 'next', at: 9_000 });

describe('between questions', () => {
  test('one press opens the next question, with nothing of the last one left on it', () => {
    const room = reveal(0, 10);
    expect(afterReveal(room)).toBe('question');
    // `toEqual` on the whole room: `toMatchObject` reads `{}` as "any object".
    expect(press(room)).toEqual({
      ...room,
      phase: 'question',
      index: 1,
      questionOpenedAt: 9_000,
      answers: {},
      lastDeltas: {},
      lastPicks: {},
      lastSteal: null,
    });
  });

  test('a second press on the same reveal opens nothing more', () => {
    const opened = press(reveal(0, 10));
    expect(press(opened)).toBe(opened);
  });

  test('the table comes after every fifth question, and nowhere else', () => {
    const phases = Array.from({ length: 15 }, (_, index) => press(reveal(index, 15)).phase);
    const tables = phases.flatMap((phase, index) => (phase === 'scoreboard' ? [index + 1] : []));
    expect(tables).toEqual([TABLE_EVERY, TABLE_EVERY * 2]);
    expect(phases[14]).toBe('finished');
  });

  test('a fifth question that is also the last goes to the results, not the table', () => {
    expect(afterReveal(reveal(4, 5))).toBe('results');
    expect(press(reveal(4, 5)).phase).toBe('finished');
  });

  test('the table at a break then opens the next question', () => {
    const table = press(reveal(4, 10));
    expect(table).toMatchObject({ phase: 'scoreboard', index: 4, lastDeltas: { ann: 1_000 } });
    expect(press(table)).toMatchObject({ phase: 'question', index: 5 });
  });

  test('five tells have scored nobody, so there is no table to show after them', () => {
    const questions = [
      ...Array.from({ length: 5 }, (_, i) => question(`t${i}`, 'tell')),
      ...Array.from({ length: 5 }, (_, i) => question(`g${i}`, 'guess')),
    ];
    expect(afterReveal(reveal(4, 10, { questions }))).toBe('question');
    expect(press(reveal(4, 10, { questions })).phase).toBe('question');
  });
});

describe('the last reveal', () => {
  test('before a final it is the table, and without one the results', () => {
    expect(afterReveal(reveal(9, 10, { standoffEnabled: true }))).toBe('table');
    expect(press(reveal(9, 10, { standoffEnabled: true })).phase).toBe('scoreboard');
    expect(afterReveal(reveal(9, 10))).toBe('results');
  });
});

describe('the table on request', () => {
  const show = (room: RoomState): RoomState => reduce(room, { type: 'showTable' });

  test('the quizmaster can show it after any question, and it leads on to the next', () => {
    const table = show(reveal(1, 10));
    expect(table).toMatchObject({ phase: 'scoreboard', index: 1, lastDeltas: { ann: 1_000 } });
    expect(press(table)).toMatchObject({ phase: 'question', index: 2 });
  });

  test('not from the last reveal, which leaves the podium something to say', () => {
    const last = reveal(9, 10);
    expect(show(last)).toBe(last);
  });

  test('not from anywhere but a reveal', () => {
    for (const phase of ['lobby', 'question', 'scoreboard', 'standoff', 'finished'] as const) {
      const room = reveal(1, 10, { phase });
      expect(show(room), phase).toBe(room);
    }
  });
});

describe('a thrown-out question', () => {
  test('still stops at the table, which is the only screen that says so', () => {
    const skipped = reduce(reveal(1, 10), { type: 'skip' });
    expect(skipped.phase).toBe('scoreboard');
    expect(press(skipped)).toMatchObject({ phase: 'question', index: 2 });
  });
});
