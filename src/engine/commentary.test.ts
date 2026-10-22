import { describe, expect, test } from 'vitest';
import { LINES, commentFor } from './commentary';
import { createRoom, type QuizQuestion, type RoomState } from './state';

/*
  The Commentator's facts (docs/decisions/commentator.md, M1–M6): one line per
  moment or none, the same on every device because it reads only the room.
*/

const Q: QuizQuestion = { id: 'q', prompt: 'p', options: ['a', 'b', 'c', 'd'], correctIndex: 0, category: 'c', difficulty: 'easy' };
const players = {
  ann: { name: 'Ann', joinedAt: 1 },
  bob: { name: 'Bob', joinedAt: 2 },
  cass: { name: 'Cass', joinedAt: 3 },
  dan: { name: 'Dan', joinedAt: 4 },
};
const pick = (optionIndex: number) => ({ optionIndex, elapsedMs: 1_000 });

function room(overrides: Partial<RoomState>): RoomState {
  return { ...createRoom('ABCD'), gameId: 'g', players, questions: [Q, Q, Q], index: 1, ...overrides };
}

describe('at the reveal', () => {
  const reveal = (lastPicks: RoomState['lastPicks']) => commentFor(room({ phase: 'reveal', lastPicks }), 'reveal');

  test('nobody right', () => {
    expect(reveal({ ann: pick(1), bob: pick(2) })?.fact).toBe('nobody');
  });

  test('everybody right, from three up', () => {
    expect(reveal({ ann: pick(0), bob: pick(0), cass: pick(0) })?.fact).toBe('everybody');
    expect(reveal({ ann: pick(0), bob: pick(0) })).toBeNull();
  });

  test('the lone right answer, named', () => {
    expect(reveal({ ann: pick(1), bob: pick(0), cass: pick(2) })).toEqual({ fact: 'lone', text: 'Bob, and nobody else.' });
  });

  test('an even split, from four up', () => {
    expect(reveal({ ann: pick(0), bob: pick(0), cass: pick(1), dan: pick(1) })?.fact).toBe('split');
  });

  test('says nothing when nothing happened', () => {
    expect(reveal({ ann: pick(0), bob: pick(0), cass: pick(1) })).toBeNull();
  });

  test('never names somebody who has left (M6): their pick is not the room\'s', () => {
    // The leaver was the only one right; of the room, nobody was.
    const said = reveal({ ann: pick(1), gone: pick(0), cass: pick(2) });
    expect(said?.fact).toBe('nobody');
    expect(said?.text).not.toContain('gone');
  });

  test('says nothing on Survey Says (M6)', () => {
    const survey = { ...Q, survey: { part: 'guess' as const, promptId: 'p' } };
    expect(commentFor(room({ phase: 'reveal', questions: [survey, survey], lastPicks: { ann: pick(1), bob: pick(2) } }), 'reveal')).toBeNull();
  });
});

describe('at the scoreboard', () => {
  test('a new leader, and a new leader who has never won', () => {
    const scores = { ann: 1_000, bob: 1_800, cass: 0, dan: 0 };
    const lastDeltas = { bob: 1_000 };
    expect(commentFor(room({ phase: 'scoreboard', scores, lastDeltas }), 'scoreboard')?.text).toBe('Bob takes the lead.');
    const history = { bob: { played: 6, wins: 0, best: 4_000 } };
    expect(commentFor(room({ phase: 'scoreboard', scores, lastDeltas, history }), 'scoreboard')?.fact).toBe('newLeaderNeverWon');
  });

  test('neck and neck, and running away with it', () => {
    expect(commentFor(room({ phase: 'scoreboard', scores: { ann: 1_000, bob: 950 } }), 'scoreboard')?.fact).toBe('neckAndNeck');
    expect(commentFor(room({ phase: 'scoreboard', scores: { ann: 4_000, bob: 1_000 } }), 'scoreboard')?.fact).toBe('runaway');
  });

  test('nothing when the table is on zero', () => {
    expect(commentFor(room({ phase: 'scoreboard', scores: { ann: 0, bob: 0 } }), 'scoreboard')).toBeNull();
  });
});

describe('at the podium', () => {
  const finished = (history: RoomState['history']) =>
    commentFor(room({ phase: 'finished', scores: { ann: 5_000, bob: 3_000 }, history }), 'podium');

  test('a debut win, a first win, a season best, and a winner again', () => {
    expect(finished({ ann: { played: 0, wins: 0, best: 0 } })?.fact).toBe('debutWin');
    expect(finished({ ann: { played: 4, wins: 0, best: 3_000 } })?.fact).toBe('firstWin');
    expect(finished({ ann: { played: 9, wins: 2, best: 4_000 } })?.fact).toBe('seasonBest');
    expect(finished({ ann: { played: 9, wins: 2, best: 6_000 } })?.text).toBe('Ann again. That makes 3.');
  });

  test('nothing for a dead heat, or a winner the season knows nothing about', () => {
    expect(commentFor(room({ phase: 'finished', scores: { ann: 5_000, bob: 5_000 } }), 'podium')).toBeNull();
    expect(finished({})).toBeNull();
  });
});

describe('the lines', () => {
  test('about thirty, every one filled', () => {
    const all = Object.values(LINES).flat();
    expect(all.length).toBeGreaterThanOrEqual(28);
    expect(all.every((text) => text.trim().length > 0)).toBe(true);
  });

  test('the same fact on the next question is a different line (M2)', () => {
    const at = (index: number) => commentFor(room({ phase: 'reveal', index, lastPicks: { ann: pick(1), bob: pick(2) } }), 'reveal')?.text;
    expect(at(1)).not.toBe(at(2));
  });

  test('only for the moment asked about', () => {
    expect(commentFor(room({ phase: 'reveal', lastPicks: { ann: pick(1), bob: pick(2) } }), 'scoreboard')).toBeNull();
  });
});
