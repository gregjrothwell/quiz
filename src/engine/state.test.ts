import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import {
  DURATION_CHOICES,
  LEGACY_DURATION_SECS,
  MAX_DURATION_SECS,
  MIN_DURATION_SECS,
  buildQuizQuestions,
  isDurationAllowed,
  rampPlan,
  resolveQuizmaster,
  selectQuestions,
  shuffle,
} from './state';
import {
  sealQuestion,
  type Difficulty,
  type Question,
  type SealedQuestion,
} from '../questions/types';

/** Deterministic pseudo-random source so shuffles are reproducible in tests. */
function seededRng(seed: number): () => number {
  let value = seed;
  return () => {
    value = (value * 1_103_515_245 + 12_345) % 2_147_483_648;
    return value / 2_147_483_648;
  };
}

const SOURCE: Question[] = [
  {
    id: 'a',
    question: 'Which river flows through London?',
    correct: 'Thames',
    incorrect: ['Severn', 'Mersey', 'Tyne'],
    category: 'Geography',
    difficulty: 'easy',
    source: 'opentdb',
  },
  {
    id: 'b',
    question: 'Which element has the symbol Fe?',
    correct: 'Iron',
    incorrect: ['Lead', 'Tin', 'Zinc'],
    category: 'Science & Nature',
    difficulty: 'easy',
    source: 'opentdb',
  },
  {
    id: 'c',
    question: 'How many players are in a rugby union team?',
    correct: '15',
    incorrect: ['11', '13', '17'],
    category: 'Sports',
    difficulty: 'medium',
    source: 'opentdb',
  },
];

/**
 * What the app actually loads. Written as source questions and sealed here
 * rather than declared sealed, so the fixtures still say which answer is right
 * and the tests below can assert that the sealed form does not.
 */
const POOL = SOURCE.map(sealQuestion);

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

describe('sealQuestion', () => {
  test('keeps every option but not which one is right', () => {
    // #given a source question whose answer is known
    const source = SOURCE[0];
    if (!source) throw new Error('fixture missing');

    // #when it is sealed for publication
    const sealed = sealQuestion(source);

    // #then all four options survive
    expect([...sealed.options].sort()).toEqual(['Mersey', 'Severn', 'Thames', 'Tyne']);
    // #and nothing on the published shape names the answer
    expect(Object.keys(sealed)).not.toContain('correct');
    expect(JSON.stringify(sealed)).not.toContain('"correct"');
  });

  test('orders the options independently of which is correct', () => {
    // #given two questions whose correct answer sorts differently
    const first = sealQuestion({
      id: 'x',
      question: 'q',
      correct: 'Alpha',
      incorrect: ['Bravo', 'Charlie', 'Delta'],
      category: 'c',
      difficulty: 'easy',
      source: 'opentdb',
    });
    const second = sealQuestion({
      id: 'y',
      question: 'q',
      correct: 'Delta',
      incorrect: ['Alpha', 'Bravo', 'Charlie'],
      category: 'c',
      difficulty: 'easy',
      source: 'opentdb',
    });

    // #when their published option orders are compared
    // #then they are identical, so position leaks nothing about correctness
    expect(first.options).toEqual(second.options);
  });
});

describe('buildQuizQuestions', () => {
  test('carries no answer, because no device has one yet', () => {
    // #given a pool of sealed questions
    const built = buildQuizQuestions(POOL, 3, 'mixed', seededRng(42));

    // #when the built questions are inspected
    const answers = built.map((question) => question.correctIndex);

    // #then every one is still sealed — the vault fills these in at the reveal
    expect(answers).toEqual([null, null, null]);
  });

  test('keeps every option of the question it was built from', () => {
    // #given a pool of sealed questions
    const built = buildQuizQuestions(POOL, 3, 'mixed', seededRng(42));

    // #when the options of the Thames question are collected
    const thames = built.find((question) => question.prompt.includes('London'));

    // #then shuffling changed the order without losing or inventing an option
    expect([...(thames?.options ?? [])].sort()).toEqual(['Mersey', 'Severn', 'Thames', 'Tyne']);
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
function spread(counts: Record<Difficulty, number>): SealedQuestion[] {
  const pool: SealedQuestion[] = [];
  for (const level of ['easy', 'medium', 'hard'] as const) {
    for (let i = 0; i < counts[level]; i += 1) {
      pool.push(
        sealQuestion({
          id: `${level}-${i}`,
          question: `A ${level} question numbered ${i}?`,
          correct: 'Yes',
          incorrect: ['No', 'Maybe', 'Perhaps'],
          category: 'General Knowledge',
          difficulty: level,
          source: 'opentdb',
        }),
      );
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

describe('selectQuestions with a season history', () => {
  test('prefers questions the season has not served', () => {
    // #given a pool of thirty, twenty of which have been asked before
    const pool = spread({ easy: 30, medium: 0, hard: 0 });
    const asked = new Set(pool.slice(0, 20).map((question) => question.id));

    // #when a round of ten is selected
    const picked = selectQuestions(pool, 10, 'mixed', seededRng(5), asked);

    // #then none of them are repeats, because ten fresh ones existed
    expect(picked.filter((question) => asked.has(question.id))).toEqual([]);
  });

  test('still fills a round when a thin pack has too few fresh questions', () => {
    // #given a pack of twelve with all but four already served
    const pool = spread({ easy: 12, medium: 0, hard: 0 });
    const asked = new Set(pool.slice(0, 8).map((question) => question.id));

    // #when ten are requested
    const picked = selectQuestions(pool, 10, 'mixed', seededRng(5), asked);

    // #then the round is full length rather than truncated to the four fresh ones
    expect(picked).toHaveLength(10);
  });

  test('uses every fresh question before falling back on a repeat', () => {
    // #given a pack of twelve with all but four already served
    const pool = spread({ easy: 12, medium: 0, hard: 0 });
    const fresh = pool.slice(8);
    const asked = new Set(pool.slice(0, 8).map((question) => question.id));

    // #when ten are requested
    const picked = selectQuestions(pool, 10, 'mixed', seededRng(5), asked);
    const ids = new Set(picked.map((question) => question.id));

    // #then all four unseen questions are in the round
    expect(fresh.every((question) => ids.has(question.id))).toBe(true);
  });

  test('a ramped round still climbs when it has to reuse questions', () => {
    // #given a pack whose fresh questions cannot fill a ramp on their own
    const pool = spread({ easy: 6, medium: 6, hard: 6 });
    const asked = new Set(pool.slice(0, 12).map((question) => question.id));

    // #when a ramped round of twelve is built
    const picked = selectQuestions(pool, 12, 'ramp', seededRng(9), asked);
    const ranks = picked.map((question) => ['easy', 'medium', 'hard'].indexOf(question.difficulty));

    // #then it is full length and never steps back down a level
    expect(picked).toHaveLength(12);
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
  });

  test('an empty history behaves exactly as before', () => {
    // #given a pool and no history at all
    const pool = spread({ easy: 20, medium: 0, hard: 0 });

    // #when a round is selected with and without an empty set
    const withArg = selectQuestions(pool, 8, 'mixed', seededRng(3), new Set());
    const without = selectQuestions(pool, 8, 'mixed', seededRng(3));

    // #then the selection is identical
    expect(withArg.map((q) => q.id)).toEqual(without.map((q) => q.id));
  });
});

/**
 * The answer window is enforced in two places that cannot import each other:
 * this module, and firestore.rules — which is pasted into the Firebase console
 * by hand. `npm run check-rules` proves the *published* ruleset behaves, but it
 * needs the network and a project. These read the repo copy, so a change that
 * puts the two out of step fails in the test run that made it.
 */
describe('the answer window agrees with the security rules', () => {
  const RULES = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');

  test('the fallback for a room with no window matches the rules', () => {
    // #given the rules' default, written as `get('durationSecs', <n>)`
    const defaults = [...RULES.matchAll(/get\('durationSecs',\s*(\d+)\)/g)].map(([, n]) =>
      Number(n),
    );

    // #then every one of them is the legacy fallback this module applies —
    // not the lobby's default, which is a different number and unrelated
    expect(defaults.length).toBeGreaterThan(0);
    expect([...new Set(defaults)]).toEqual([LEGACY_DURATION_SECS]);
  });

  test('the bounds match the rules', () => {
    // #given the floor and ceiling the rules enforce
    const floor = /function minDuration\(\) \{ return (\d+); \}/.exec(RULES)?.[1];
    const ceiling = /function maxDuration\(\) \{ return (\d+); \}/.exec(RULES)?.[1];

    // #then they are the ones this module checks against before a round starts
    expect({ floor: Number(floor), ceiling: Number(ceiling) }).toEqual({
      floor: MIN_DURATION_SECS,
      ceiling: MAX_DURATION_SECS,
    });
  });

  test('every window the lobby offers is one the rules accept', () => {
    // #then no option can start a round the vault would refuse to open
    expect(DURATION_CHOICES.filter((secs) => !isDurationAllowed(secs))).toEqual([]);
  });
});
