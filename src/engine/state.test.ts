import { describe, expect, test } from 'vitest';
import { buildQuizQuestions, rampPlan, resolveQuizmaster, selectQuestions, shuffle } from './state';
import type { Difficulty, Question } from '../questions/types';

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
    const built = buildQuizQuestions(POOL, 3, 'mixed', seededRng(42));

    // #when each built question is checked against its source
    const resolved = built.map((question) => question.options[question.correctIndex]);

    // #then every correctIndex resolves to the right answer text
    expect(resolved.sort()).toEqual(['15', 'Iron', 'Thames']);
  });

  test('takes only the requested number of questions', () => {
    // #given a pool of three questions
    const built = buildQuizQuestions(POOL, 2, 'mixed', seededRng(42));

    // #when two are requested
    const count = built.length;

    // #then only two are returned
    expect(count).toBe(2);
  });

  test('returns the whole pool when more are requested than exist', () => {
    // #given a request for more questions than the pool holds
    const built = buildQuizQuestions(POOL, 99, 'mixed', seededRng(42));

    // #when the result is counted
    const count = built.length;

    // #then it caps at the pool size
    expect(count).toBe(3);
  });

  test('returns nothing when zero questions are requested', () => {
    // #given a request for no questions
    const built = buildQuizQuestions(POOL, 0, 'mixed', seededRng(42));

    // #when the result is counted
    const count = built.length;

    // #then the result is empty
    expect(count).toBe(0);
  });

  test('gives every question four options', () => {
    // #given built questions from a pool with three distractors each
    const built = buildQuizQuestions(POOL, 3, 'mixed', seededRng(1));

    // #when option counts are collected
    const counts = built.map((question) => question.options.length);

    // #then each has four tiles to render
    expect(counts).toEqual([4, 4, 4]);
  });
});

/** A pool with a known spread: `easy` easy, `medium` medium, `hard` hard. */
function spread(counts: Record<Difficulty, number>): Question[] {
  const pool: Question[] = [];
  for (const level of ['easy', 'medium', 'hard'] as const) {
    for (let i = 0; i < counts[level]; i += 1) {
      pool.push({
        id: `${level}-${i}`,
        question: `A ${level} question numbered ${i}?`,
        correct: 'Yes',
        incorrect: ['No', 'Maybe', 'Perhaps'],
        category: 'General Knowledge',
        difficulty: level,
      });
    }
  }
  return pool;
}

describe('rampPlan', () => {
  test('always sums to the requested count', () => {
    // #given a range of round lengths
    const lengths = [1, 5, 10, 15, 20, 25, 37];

    // #when each is planned
    const sums = lengths.map((length) => {
      const plan = rampPlan(length);
      return plan.easy + plan.medium + plan.hard;
    });

    // #then no plan loses or invents a question
    expect(sums).toEqual(lengths);
  });

  test('puts the bulk of a round in the middle', () => {
    // #given a fifteen-question round
    const plan = rampPlan(15);

    // #when the ends are compared with the middle
    const result = { easy: plan.easy, medium: plan.medium, hard: plan.hard };

    // #then the two ends are equal and the middle carries the rest
    expect(result).toEqual({ easy: 5, medium: 5, hard: 5 });
  });
});

describe('selectQuestions', () => {
  test('a flat level returns only that level', () => {
    // #given a pool holding all three levels
    const pool = spread({ easy: 10, medium: 10, hard: 10 });

    // #when a hard round is selected
    const levels = new Set(
      selectQuestions(pool, 6, 'hard', seededRng(3)).map((q) => q.difficulty),
    );

    // #then nothing else is served
    expect([...levels]).toEqual(['hard']);
  });

  test('a flat level is capped by what the pack actually holds', () => {
    // #given a pack with only four hard questions
    const pool = spread({ easy: 40, medium: 40, hard: 4 });

    // #when twenty hard questions are requested
    const count = selectQuestions(pool, 20, 'hard', seededRng(3)).length;

    // #then the round is as long as the pack allows, not twenty
    expect(count).toBe(4);
  });

  test('a ramp climbs from easy to hard', () => {
    // #given a pool with plenty of every level
    const pool = spread({ easy: 40, medium: 40, hard: 40 });

    // #when a ramped round is selected
    const ranks = selectQuestions(pool, 15, 'ramp', seededRng(9)).map((q) =>
      ({ easy: 0, medium: 1, hard: 2 })[q.difficulty],
    );

    // #then difficulty never decreases as the round goes on
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });

  test('a ramp stays full length when a level is missing entirely', () => {
    // #given a pack with no hard questions at all
    const pool = spread({ easy: 40, medium: 40, hard: 0 });

    // #when a fifteen-question ramp is selected
    const selected = selectQuestions(pool, 15, 'ramp', seededRng(9));

    // #then the shortfall is made up from the levels that do exist
    expect(selected.length).toBe(15);
  });

  test('a ramp cannot exceed the pool', () => {
    // #given a pool smaller than the requested round
    const pool = spread({ easy: 2, medium: 2, hard: 1 });

    // #when twenty questions are requested
    const count = selectQuestions(pool, 20, 'ramp', seededRng(9)).length;

    // #then it returns everything available and stops
    expect(count).toBe(5);
  });

  test('a ramp never repeats a question', () => {
    // #given a pack thin enough to force top-ups from other levels
    const pool = spread({ easy: 3, medium: 40, hard: 1 });

    // #when a twenty-question ramp is selected
    const selected = selectQuestions(pool, 20, 'ramp', seededRng(4));

    // #then every question in it is distinct
    expect(new Set(selected.map((q) => q.id)).size).toBe(selected.length);
  });

  test('mixed leaves the pack as it comes', () => {
    // #given a pool that is mostly easy
    const pool = spread({ easy: 30, medium: 3, hard: 3 });

    // #when a mixed round is selected
    const levels = new Set(selectQuestions(pool, 20, 'mixed', seededRng(5)).map((q) => q.difficulty));

    // #then more than one level is served
    expect(levels.size).toBeGreaterThan(1);
  });
});
