import { describe, expect, test } from 'vitest';
import { ownLine, ownLineWords } from './ownLine';
import { createRoom, type QuizQuestion, type RoomState } from './state';

/** Your own line at the reveal (PROJ-182, criterion 1): place, movement, points. */

const PLAYERS = Object.fromEntries(
  ['ann', 'bob', 'cat', 'dev'].map((uid, i) => [uid, { name: uid, joinedAt: i }]),
);

const QUESTION: QuizQuestion = {
  id: 'q1', prompt: 'q', options: ['a', 'b'], correctIndex: 0, category: 'c', difficulty: 'easy',
};

function room(scores: Record<string, number>, deltas: Record<string, number>, overrides: Partial<RoomState> = {}): RoomState {
  return {
    ...createRoom('HKQ7'),
    phase: 'reveal',
    index: 3,
    questions: [QUESTION, QUESTION, QUESTION, QUESTION, QUESTION],
    players: PLAYERS,
    scores,
    lastDeltas: deltas,
    ...overrides,
  };
}

const words = (state: RoomState, uid: string): string | null => {
  const line = ownLine(state, uid);
  return line && ownLineWords(line);
};

describe('your own line', () => {
  test('says where you are and how that question moved you', () => {
    // Bob was fourth on 1,000 and passes Cat.
    const state = room(
      { ann: 4_000, dev: 3_000, bob: 1_800, cat: 1_500 },
      { ann: 0, bob: 800, cat: 0, dev: 0 },
    );
    expect(ownLine(state, 'bob')).toEqual({ place: 3, joint: false, moved: 1 });
    expect(words(state, 'bob')).toBe('3rd, up one');
    expect(words(state, 'cat')).toBe('4th, down one');
    expect(words(state, 'ann')).toBe('still 1st');
  });

  test('counts in words, and goes down as well as up', () => {
    const state = room(
      { ann: 4_000, bob: 3_900, cat: 3_800, dev: 3_700 },
      { ann: 4_000, bob: 0, cat: 0, dev: 0 },
    );
    expect(words(state, 'ann')).toBe('1st, up three');
    expect(words(state, 'bob')).toBe('2nd, down one');
  });

  test('a shared place says so', () => {
    const state = room({ ann: 2_000, bob: 2_000, cat: 0, dev: 0 }, { ann: 1_000, bob: 2_000, cat: 0, dev: 0 });
    expect(words(state, 'ann')).toBe('still joint 1st');
    expect(words(state, 'bob')).toBe('joint 1st, up one');
    expect(words(state, 'cat')).toBe('joint 3rd, down one');
  });

  test('question one moves nobody: there was no table to move on', () => {
    const state = room({ ann: 1_000, bob: 900, cat: 0, dev: 0 }, { ann: 1_000, bob: 900, cat: 0, dev: 0 }, { index: 0 });
    expect(ownLine(state, 'cat')).toEqual({ place: 3, joint: true, moved: null });
    expect(words(state, 'ann')).toBe('1st');
    expect(words(state, 'cat')).toBe('joint 3rd');
  });

  test('a question nobody scored on leaves everyone where they were', () => {
    const state = room({ ann: 4_000, bob: 3_000, cat: 2_000, dev: 1_000 }, {});
    expect(words(state, 'dev')).toBe('still 4th');
  });

  test('a lost stake moves you down the same way', () => {
    const state = room({ ann: 2_000, bob: 3_000, cat: 0, dev: 0 }, { ann: -2_000, bob: 0, cat: 0, dev: 0 });
    expect(words(state, 'ann')).toBe('2nd, down one');
  });

  test('the second half of The Double places you on the morning, as the table does', () => {
    // Level on the round; Ann's first half puts her ahead.
    const state = room(
      { ann: 1_000, bob: 1_000 },
      { ann: 0, bob: 1_000 },
      { double: { gameId: 'g0', scores: { ann: 500, bob: 0 } } },
    );
    expect(words(state, 'bob')).toBe('still 2nd');
    expect(words(state, 'ann')).toBe('still 1st');
  });

  test('a board with nothing on it has no places', () => {
    const state = room({ ann: 0, bob: 0, cat: 0, dev: 0 }, { ann: 0, bob: 0, cat: 0, dev: 0 }, { index: 0 });
    expect(ownLine(state, 'ann')).toBeNull();
  });

  test('nobody who is not on the board has one, and a tell has none for anybody', () => {
    const state = room({ ann: 1_000, bob: 0 }, { ann: 1_000 });
    expect(ownLine(state, 'ghost')).toBeNull();
    expect(ownLine(state, null)).toBeNull();
    const tell = room({ ann: 1_000 }, {}, {
      questions: Array.from({ length: 5 }, () => ({ ...QUESTION, survey: { part: 'tell' as const, promptId: 'p' } })),
    });
    expect(ownLine(tell, 'ann')).toBeNull();
  });
});
