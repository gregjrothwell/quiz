import { describe, expect, test } from 'vitest';
import { reduce, type Action } from './reducer';
import { standings } from './scoring';
import { buildQuizQuestions, createRoom, resolveQuizmaster, type RoomState } from './state';
import type { Question } from '../questions/types';

/**
 * Plays whole games end to end through the reducer.
 *
 * The Firestore wiring still needs a real project to exercise, but everything
 * that decides who wins lives here, so a full round is worth driving in a test
 * rather than discovering a scoring bug live in front of the team.
 */

const POOL: Question[] = [
  {
    id: 'a',
    question: 'Which river flows through London?',
    correct: 'Thames',
    incorrect: ['Severn', 'Mersey', 'Tyne'],
    category: 'Geography',
    difficulty: 'easy',
  },
  {
    id: 'b',
    question: 'Which element has the symbol Fe?',
    correct: 'Iron',
    incorrect: ['Lead', 'Tin', 'Zinc'],
    category: 'Science & Nature',
    difficulty: 'easy',
  },
  {
    id: 'c',
    question: 'How many players are in a rugby union team?',
    correct: '15',
    incorrect: ['11', '13', '17'],
    category: 'Sports',
    difficulty: 'medium',
  },
];

function seededRng(seed: number): () => number {
  let value = seed;
  return () => {
    value = (value * 1_103_515_245 + 12_345) % 2_147_483_648;
    return value / 2_147_483_648;
  };
}

function apply(state: RoomState, ...actions: Action[]): RoomState {
  return actions.reduce(reduce, state);
}

/** A three-player room with all three questions loaded and the first one open. */
function startedGame(): RoomState {
  const questions = buildQuizQuestions(POOL, 3, seededRng(11));
  return apply(
    createRoom('HKQ7'),
    { type: 'join', uid: 'greg', name: 'Greg', at: 100 },
    { type: 'join', uid: 'sam', name: 'Sam', at: 200 },
    { type: 'join', uid: 'priya', name: 'Priya', at: 300 },
    { type: 'selectPack', packId: 'general-knowledge', packTitle: 'General Knowledge', questions },
    { type: 'start', at: 1_000 },
  );
}

/** Answers the open question for one player, correctly or otherwise. */
function answerAs(state: RoomState, uid: string, correct: boolean, elapsedMs: number): Action {
  const question = state.questions[state.index];
  if (!question) throw new Error('No open question to answer');
  const optionIndex = correct
    ? question.correctIndex
    : (question.correctIndex + 1) % question.options.length;
  return { type: 'answer', uid, optionIndex, elapsedMs };
}

/** Advances reveal → scoreboard → next question (or finished). */
function advance(state: RoomState): RoomState {
  return apply(state, { type: 'reveal' }, { type: 'next', at: 0 }, { type: 'next', at: 0 });
}

describe('a full three-question game', () => {
  test('ends with the fastest consistently-correct player on top', () => {
    // #given three players answering every question
    let game = startedGame();

    for (let round = 0; round < 3; round += 1) {
      game = apply(
        game,
        // Greg is always right and always quickest.
        answerAs(game, 'greg', true, 1_000),
        // Sam is right but slower.
        answerAs(game, 'sam', true, 12_000),
        // Priya is always wrong.
        answerAs(game, 'priya', false, 2_000),
      );
      game = advance(game);
    }

    // #when the game finishes and standings are read
    const table = standings(game.scores).map((entry) => entry.uid);

    // #then speed breaks the tie between two correct players, and Priya is last
    expect(table).toEqual(['greg', 'sam', 'priya']);
  });

  test('reaches the finished phase after the last question', () => {
    // #given a game played to the end without anyone answering
    let game = startedGame();
    for (let round = 0; round < 3; round += 1) game = advance(game);

    // #when the phase is inspected
    const phase = game.phase;

    // #then the game is over rather than looping
    expect(phase).toBe('finished');
  });

  test('leaves everyone on zero when nobody answers anything', () => {
    // #given a game where every question times out unanswered
    let game = startedGame();
    for (let round = 0; round < 3; round += 1) game = advance(game);

    // #when the scores are read
    const scores = game.scores;

    // #then nobody gained a point
    expect(scores).toEqual({ greg: 0, sam: 0, priya: 0 });
  });

  test('excludes a skipped question from the final scores', () => {
    // #given a game where the quizmaster throws out the second question after
    // it had already been answered correctly
    let game = startedGame();
    game = apply(game, answerAs(game, 'greg', true, 0));
    game = advance(game);

    game = apply(game, answerAs(game, 'greg', true, 0), { type: 'reveal' }, { type: 'skip' });
    game = apply(game, { type: 'next', at: 0 });

    game = apply(game, answerAs(game, 'greg', true, 0));
    game = advance(game);

    // #when the final score is read
    const score = game.scores['greg'];

    // #then only the two counted questions scored, not the skipped one
    expect(score).toBe(2_000);
  });

  test('keeps playing when the quizmaster drops out mid-game', () => {
    // #given a started game whose quizmaster disconnects
    let game = startedGame();
    game = apply(game, answerAs(game, 'sam', true, 0), { type: 'leave', uid: 'greg' });

    // #when the round is carried through to the end
    game = advance(game);
    for (let round = 0; round < 2; round += 1) game = advance(game);

    // #then the role passed to the next-longest-present player and the game finished
    expect({ quizmaster: resolveQuizmaster(game.players), phase: game.phase }).toEqual({
      quizmaster: 'sam',
      phase: 'finished',
    });
  });

  test('lets the quizmaster reset for another round with players intact', () => {
    // #given a finished game with points on the board
    let game = startedGame();
    game = apply(game, answerAs(game, 'greg', true, 0));
    for (let round = 0; round < 3; round += 1) game = advance(game);

    // #when the room is reset
    const reset = reduce(game, { type: 'reset' });

    // #then everyone is still present, back in the lobby, on zero
    expect({
      phase: reset.phase,
      players: Object.keys(reset.players).sort(),
      scores: reset.scores,
    }).toEqual({
      phase: 'lobby',
      players: ['greg', 'priya', 'sam'],
      scores: { greg: 0, sam: 0, priya: 0 },
    });
  });
});
