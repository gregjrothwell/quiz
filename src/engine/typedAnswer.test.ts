import { describe, expect, test } from 'vitest';
import { tallyQuestion } from './scoring';
import { isUnmatched, matchTypedAnswer, NO_MATCH_INDEX } from './typedAnswer';

/**
 * Made-up options only. Catchphrase, Blankety Blank and The Price Was Right
 * are blind — nothing in here is a line from a pack.
 */

const PHRASES = ['purple harbour', 'quiet lantern', 'silver kettle', 'orange bicycle'];

describe('matchTypedAnswer', () => {
  test('takes the one option that matches once case, accents and punctuation are gone', () => {
    expect(matchTypedAnswer('Purple Harbour', PHRASES)).toBe(0);
    expect(matchTypedAnswer('  PURPLE   HARBOUR! ', PHRASES)).toBe(0);
    expect(matchTypedAnswer('café zebra', ['Cafe zebra', 'quiet lantern', 'silver kettle', 'ink quill'])).toBe(0);
    expect(matchTypedAnswer('ink and quill', ['Ink & Quill', 'quiet lantern', 'silver kettle', 'orange bicycle'])).toBe(0);
    expect(matchTypedAnswer("ink's quill", ['Inks quill', 'quiet lantern', 'silver kettle', 'orange bicycle'])).toBe(0);
    expect(matchTypedAnswer('ink quill', ['ink-quill', 'quiet lantern', 'silver kettle', 'orange bicycle'])).toBe(0);
  });

  test('drops a leading the, a or an and leaves one in the middle', () => {
    expect(matchTypedAnswer('the purple harbour', PHRASES)).toBe(0);
    expect(matchTypedAnswer('an orange bicycle', PHRASES)).toBe(3);
    expect(matchTypedAnswer('captain of the yard', ['The captain of the yard', 'quiet lantern', 'silver kettle', 'orange bicycle'])).toBe(0);
    // "another" is not the article "an".
    expect(matchTypedAnswer('another harbour', ['Another harbour', 'quiet lantern', 'silver kettle', 'orange bicycle'])).toBe(0);
    expect(matchTypedAnswer('harbour', ['Another harbour', 'quiet lantern', 'silver kettle', 'orange bicycle'])).toBe(NO_MATCH_INDEX);
  });

  test('allows one edit per five letters, at most two, and only for a clear winner', () => {
    // "purple harbour" is 14 letters: budget 2. One substitution.
    expect(matchTypedAnswer('purple harbur', PHRASES)).toBe(0);
    // A substitution and a deletion: two edits, still inside the budget.
    expect(matchTypedAnswer('purplx harbur', PHRASES)).toBe(0);
    // Three substitutions is over the cap of two.
    expect(matchTypedAnswer('xxxple harbour', PHRASES)).toBe(NO_MATCH_INDEX);
    // Five letters allow one. Four letters allow none.
    expect(matchTypedAnswer('grapt', ['grape', 'lemon', 'melon', 'peach'])).toBe(0);
    expect(matchTypedAnswer('grp', ['grape', 'lemon', 'melon', 'peach'])).toBe(NO_MATCH_INDEX);
    expect(matchTypedAnswer('cot', ['cat', 'dog', 'rat', 'hen'])).toBe(NO_MATCH_INDEX);
  });

  test('refuses a typo that is not strictly closer than the runner-up', () => {
    const close = ['purple harbour', 'purple harbous', 'quiet lantern', 'silver kettle'];
    // One off both of the first two.
    expect(matchTypedAnswer('purple harbou', close)).toBe(NO_MATCH_INDEX);
    // Two options that normalise to the same string are not "exactly one".
    expect(matchTypedAnswer('the cat', ['The Cat', 'Cat', 'quiet lantern', 'silver kettle'])).toBe(NO_MATCH_INDEX);
  });

  test('gives no partial credit for one word of a longer phrase', () => {
    expect(matchTypedAnswer('purple', PHRASES)).toBe(NO_MATCH_INDEX);
    expect(matchTypedAnswer('harbour', PHRASES)).toBe(NO_MATCH_INDEX);
    expect(matchTypedAnswer('', PHRASES)).toBe(NO_MATCH_INDEX);
    expect(matchTypedAnswer('   ', PHRASES)).toBe(NO_MATCH_INDEX);
  });

  test('Blankety Blank is exact only', () => {
    const blanks = ['harbour', 'harbous', 'lantern', 'kettle'];
    expect(matchTypedAnswer('harbour', blanks, true)).toBe(0);
    expect(matchTypedAnswer('harbur', blanks, true)).toBe(NO_MATCH_INDEX);
    expect(matchTypedAnswer('Harbour!', blanks, true)).toBe(0);
  });

  test('a no-match is the index past four options', () => {
    expect(NO_MATCH_INDEX).toBe(4);
    expect(matchTypedAnswer('nothing like these', PHRASES)).toBe(4);
    expect(isUnmatched(4)).toBe(true);
    expect(isUnmatched(3)).toBe(false);
    expect(isUnmatched(9)).toBe(true);
  });
});

describe('a call in the rank race', () => {
  test('an earlier correct call beats a tap and a wrong call scores nothing', () => {
    // No extra bonus. First is 500 + 500, second is 500 + 400, wrong is 0.
    const deltas = tallyQuestion({
      correctIndex: 0,
      answers: {
        caller: { optionIndex: 0, elapsedMs: 3_000 },
        tapper: { optionIndex: 0, elapsedMs: 5_100 },
        wrongCall: { optionIndex: NO_MATCH_INDEX, elapsedMs: 1_000 },
      },
    });

    expect(deltas).toEqual({ caller: 1_000, tapper: 900, wrongCall: 0 });
  });
});
