import { describe, expect, test } from 'vitest';
import {
  BAD_SHARE_TO_RETIRE,
  MIN_VOTES_TO_RETIRE,
  isVerdict,
  shouldRetire,
  tally,
  type Verdict,
} from './questionVote';

describe('isVerdict', () => {
  test('accepts the two the rules accept', () => {
    expect(isVerdict('good')).toBe(true);
    expect(isVerdict('bad')).toBe(true);
  });

  test('rejects anything else, which is what the rules also do', () => {
    // The security rule pins `verdict` to these two by name. A third value
    // reaching Firestore would be refused, so the client must not offer one.
    for (const value of ['rubbish', '', 'GOOD', 0, null, undefined, {}]) {
      expect(isVerdict(value)).toBe(false);
    }
  });
});

describe('tally', () => {
  test('counts each side', () => {
    const verdicts: Verdict[] = ['bad', 'good', 'bad', 'bad'];
    expect(tally(verdicts)).toEqual({ good: 1, bad: 3 });
  });

  test('an empty round is two zeroes, not a divide by zero', () => {
    expect(tally([])).toEqual({ good: 0, bad: 0 });
  });
});

describe('shouldRetire', () => {
  test('retires a question the room agreed was bad', () => {
    // #given more than the floor, nearly all of them against
    const verdict = shouldRetire({ good: 1, bad: 9 });

    expect(verdict).toBe(true);
  });

  test('keeps a question nobody minded', () => {
    expect(shouldRetire({ good: 9, bad: 1 })).toBe(false);
  });

  describe('the floor, which is the only thing blunting a single loud voter', () => {
    test('refuses to retire on too few votes, however damning', () => {
      // #given one short of the floor and every one of them bad
      const votes = { good: 0, bad: MIN_VOTES_TO_RETIRE - 1 };

      // #then it stays: nothing stops somebody voting from the console, and a
      // unanimous four is what one person with two browsers looks like
      expect(shouldRetire(votes)).toBe(false);
    });

    test('retires once the floor is reached', () => {
      expect(shouldRetire({ good: 0, bad: MIN_VOTES_TO_RETIRE })).toBe(true);
    });

    test('a question nobody voted on is never retired', () => {
      // The case that would empty the corpus if the share were computed on a
      // zero total and came back NaN — or worse, on a total of zero read as
      // unanimous.
      expect(shouldRetire({ good: 0, bad: 0 })).toBe(false);
    });
  });

  describe('the share', () => {
    test('retires exactly at the threshold, not just past it', () => {
      // #given a tally landing precisely on the share
      const votes = { good: 4, bad: 6 };
      expect(votes.bad / (votes.good + votes.bad)).toBe(BAD_SHARE_TO_RETIRE);

      // #then it goes — the threshold is inclusive, so the constant means what
      // it says rather than meaning "a bit more than this"
      expect(shouldRetire(votes)).toBe(true);
    });

    test('keeps a question one vote short of the share', () => {
      expect(shouldRetire({ good: 5, bad: 5 })).toBe(false);
    });
  });

  test('is not fooled by a negative or fractional count', () => {
    // Counts come from counting documents, so these cannot occur — but this
    // decides what leaves the corpus permanently, and returning false on
    // nonsense is the safe direction.
    expect(shouldRetire({ good: -10, bad: 3 })).toBe(false);
    expect(shouldRetire({ good: 0, bad: 2.5 })).toBe(false);
  });
});
