import { describe, expect, test } from 'vitest';
import { buildQuizQuestions, resolveQuizmaster, shuffle } from './state';
import type { Question } from '../questions/types';

/** Deterministic pseudo-random source so shuffles are reproducible in tests. */
function seededRng(seed: number): () => number {
  let value = seed;
  return () => {
    value = (value * 1_103_515_245 + 12_345) % 2_147_483_648;
    return value / 2_147_483_648;
  };
}

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

describe('resolveQuizmaster', () => {
  test('picks the longest-present player', () => {
    // #given three players who joined at different times
    const players = {
      late: { name: 'Alex', joinedAt: 300 },
      first: { name: 'Greg', joinedAt: 100 },
      middle: { name: 'Sam', joinedAt: 200 },
    };

    // #when the quizmaster is resolved
    const result = resolveQuizmaster(players);

    // #then the earliest joiner holds the role regardless of key order
    expect(result).toBe('first');
  });

  test('breaks a joinedAt tie on uid so all clients agree', () => {
    // #given two players with identical join timestamps
    const players = {
      zoe: { name: 'Zoe', joinedAt: 100 },
      adam: { name: 'Adam', joinedAt: 100 },
    };

    // #when the quizmaster is resolved
    const result = resolveQuizmaster(players);

    // #then the lower uid wins, deterministically on every device
    expect(result).toBe('adam');
  });

  test('returns null for an empty room', () => {
    // #given a room with nobody in it
    const players = {};

    // #when the quizmaster is resolved
    const result = resolveQuizmaster(players);

    // #then there is no quizmaster
    expect(result).toBeNull();
  });
});

describe('shuffle', () => {
  test('preserves every element', () => {
    // #given a list of items
    const items = [1, 2, 3, 4, 5];

    // #when it is shuffled
    const result = shuffle(items, seededRng(7));

    // #then the same elements are present
    expect([...result].sort()).toEqual([1, 2, 3, 4, 5]);
  });

  test('leaves the original array untouched', () => {
    // #given a list of items
    const items = [1, 2, 3, 4, 5];

    // #when it is shuffled
    shuffle(items, seededRng(7));

    // #then the caller's array is unmodified
    expect(items).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('buildQuizQuestions', () => {
  test('points correctIndex at the correct option after shuffling', () => {
    // #given a pool of questions
    const built = buildQuizQuestions(POOL, 3, seededRng(42));

    // #when each built question is checked against its source
    const resolved = built.map((question) => question.options[question.correctIndex]);

    // #then every correctIndex resolves to the right answer text
    expect(resolved.sort()).toEqual(['15', 'Iron', 'Thames']);
  });

  test('takes only the requested number of questions', () => {
    // #given a pool of three questions
    const built = buildQuizQuestions(POOL, 2, seededRng(42));

    // #when two are requested
    const count = built.length;

    // #then only two are returned
    expect(count).toBe(2);
  });

  test('returns the whole pool when more are requested than exist', () => {
    // #given a request for more questions than the pool holds
    const built = buildQuizQuestions(POOL, 99, seededRng(42));

    // #when the result is counted
    const count = built.length;

    // #then it caps at the pool size
    expect(count).toBe(3);
  });

  test('returns nothing when zero questions are requested', () => {
    // #given a request for no questions
    const built = buildQuizQuestions(POOL, 0, seededRng(42));

    // #when the result is counted
    const count = built.length;

    // #then the result is empty
    expect(count).toBe(0);
  });

  test('gives every question four options', () => {
    // #given built questions from a pool with three distractors each
    const built = buildQuizQuestions(POOL, 3, seededRng(1));

    // #when option counts are collected
    const counts = built.map((question) => question.options.length);

    // #then each has four tiles to render
    expect(counts).toEqual([4, 4, 4]);
  });
});
