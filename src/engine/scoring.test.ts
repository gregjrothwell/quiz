import { describe, expect, test } from 'vitest';
import { BASE_POINTS, SPEED_POINTS, scoreAnswer, standings, tallyQuestion } from './scoring';
import { QUESTION_DURATION_MS, type QuizQuestion } from './state';

const question: QuizQuestion = {
  id: 'q1',
  prompt: 'Which river flows through London?',
  options: ['Severn', 'Thames', 'Mersey', 'Tyne'],
  correctIndex: 1,
  category: 'Geography',
  difficulty: 'easy',
};

describe('scoreAnswer', () => {
  test('awards the maximum for an instant correct answer', () => {
    // #given a correct answer with no time elapsed
    const input = { correct: true, elapsedMs: 0 };

    // #when it is scored
    const score = scoreAnswer(input);

    // #then it earns base plus the full speed bonus
    expect(score).toBe(BASE_POINTS + SPEED_POINTS);
  });

  test('awards only the base for a correct answer at the buzzer', () => {
    // #given a correct answer landing exactly as the window closes
    const input = { correct: true, elapsedMs: QUESTION_DURATION_MS };

    // #when it is scored
    const score = scoreAnswer(input);

    // #then the speed bonus has fully decayed
    expect(score).toBe(BASE_POINTS);
  });

  test('awards half the speed bonus at the midpoint', () => {
    // #given a correct answer at half time
    const input = { correct: true, elapsedMs: QUESTION_DURATION_MS / 2 };

    // #when it is scored
    const score = scoreAnswer(input);

    // #then the bonus is halved
    expect(score).toBe(BASE_POINTS + SPEED_POINTS / 2);
  });

  test('awards nothing for a wrong answer however fast', () => {
    // #given an instant but incorrect answer
    const input = { correct: false, elapsedMs: 0 };

    // #when it is scored
    const score = scoreAnswer(input);

    // #then speed earns nothing without correctness
    expect(score).toBe(0);
  });

  test('clamps an elapsed time beyond the window', () => {
    // #given a correct answer recorded after the window somehow
    const input = { correct: true, elapsedMs: QUESTION_DURATION_MS * 10 };

    // #when it is scored
    const score = scoreAnswer(input);

    // #then it floors at the base rather than going negative
    expect(score).toBe(BASE_POINTS);
  });

  test('clamps a negative elapsed time from clock skew', () => {
    // #given a clock skew producing a negative elapsed time
    const input = { correct: true, elapsedMs: -5_000 };

    // #when it is scored
    const score = scoreAnswer(input);

    // #then it caps at the maximum rather than exceeding it
    expect(score).toBe(BASE_POINTS + SPEED_POINTS);
  });
});

describe('tallyQuestion', () => {
  test('scores each answer by correctness and speed', () => {
    // #given a fast correct answer and a slow wrong one
    const answers = {
      fast: { optionIndex: 1, elapsedMs: 0 },
      slow: { optionIndex: 0, elapsedMs: 10_000 },
    };

    // #when the question is tallied
    const deltas = tallyQuestion({ question, answers });

    // #then only the correct answer scores, at full speed value
    expect(deltas).toEqual({ fast: 1000, slow: 0 });
  });

  test('omits players who did not answer', () => {
    // #given nobody answered
    const answers = {};

    // #when the question is tallied
    const deltas = tallyQuestion({ question, answers });

    // #then the result is empty, distinguishing silence from a wrong answer
    expect(deltas).toEqual({});
  });
});

describe('standings', () => {
  test('ranks players by score, highest first', () => {
    // #given three distinct scores
    const scores = { alice: 500, bob: 1500, carol: 1000 };

    // #when standings are computed
    const result = standings(scores);

    // #then they are ordered high to low
    expect(result.map((entry) => entry.uid)).toEqual(['bob', 'carol', 'alice']);
  });

  test('gives tied players the same position and skips the next', () => {
    // #given two players tied at the top
    const scores = { alice: 1000, bob: 1000, carol: 500 };

    // #when standings are computed
    const result = standings(scores);

    // #then both are first and the next player is third
    expect(result.map((entry) => entry.position)).toEqual([1, 1, 3]);
  });

  test('returns nothing when no one has a score', () => {
    // #given an empty score table
    const scores = {};

    // #when standings are computed
    const result = standings(scores);

    // #then there are no standings
    expect(result).toEqual([]);
  });
});
