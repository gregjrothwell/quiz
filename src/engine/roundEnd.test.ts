import { describe, expect, test } from 'vitest';
import { finalistsAfterLast } from './double';
import { reduce } from './reducer';
import { createRoom, type QuizQuestion, type RoomState } from './state';

/**
 * Where the host's button goes from the last reveal. docs/decisions/round-end.md.
 * Each direction, because "goes to the results" alone is satisfied by a final
 * that never plays.
 */

const question = (id: string): QuizQuestion =>
  ({ id, prompt: id, options: ['a', 'b'], correctIndex: 0, difficulty: 'easy' }) as QuizQuestion;

const PLAYERS = { ann: { name: 'Ann', joinedAt: 1 }, bob: { name: 'Bob', joinedAt: 2 } };

function reveal(overrides: Partial<RoomState> = {}): RoomState {
  return {
    ...createRoom('HKQ7'),
    phase: 'reveal',
    gameId: 'g1',
    index: 1,
    questions: [question('q1'), question('q2')],
    players: PLAYERS,
    scores: { ann: 3_000, bob: 1_000 },
    lastDeltas: { ann: 1_000 },
    lastPicks: { ann: { optionIndex: 0, elapsedMs: 1_200 } },
    ...overrides,
  };
}

const next = (room: RoomState) => reduce(room, { type: 'next', at: 9_000 });

describe('the last reveal', () => {
  test('goes straight to the results when no final follows, leaving nothing of the question behind', () => {
    const after = next(reveal());
    expect(after.phase).toBe('finished');
    expect(after.lastDeltas).toEqual({});
    expect(after.lastPicks).toEqual({});
    expect(after.scores).toEqual({ ann: 3_000, bob: 1_000 });
  });

  test('keeps the table when a final follows, and the table then leads into it', () => {
    const after = next(reveal({ standoffEnabled: true }));
    expect(after.phase).toBe('scoreboard');
    expect(next(after).phase).toBe('standoff');
  });

  test('goes straight to half-time on the first half of a double, final or no final', () => {
    const after = next(reveal({ doubleEnabled: true, double: null, standoffEnabled: true }));
    expect(after.phase).toBe('finished');
    expect(after.standoff).toBeNull();
  });

  test('keeps the table before the final on the second half of a double', () => {
    const after = next(reveal({
      doubleEnabled: true,
      double: { gameId: 'g0', scores: { ann: 1, bob: 2 } },
      standoffEnabled: true,
    }));
    expect(after.phase).toBe('scoreboard');
  });

  test('a room of one has nobody to play a final, so it goes to the results', () => {
    const after = next(reveal({ standoffEnabled: true, players: { ann: PLAYERS.ann }, scores: { ann: 3_000 } }));
    expect(after.phase).toBe('finished');
  });
});

describe('a reveal before the last', () => {
  test('still goes to the table', () => {
    expect(next(reveal({ index: 0 })).phase).toBe('scoreboard');
  });
});

describe('a last question thrown out', () => {
  test('lands on the table, which then goes to the results', () => {
    const skipped = reduce(reveal(), { type: 'skip' });
    expect(skipped.phase).toBe('scoreboard');
    expect(next(skipped).phase).toBe('finished');
  });
});

describe('finalistsAfterLast', () => {
  test('names who the reducer puts through, and nobody when the final is off', () => {
    const on = reveal({ standoffEnabled: true });
    expect(finalistsAfterLast(on)).toEqual(next(next(on)).standoff?.finalists);
    expect(finalistsAfterLast(reveal())).toBeNull();
  });
});
