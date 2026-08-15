import { describe, expect, test } from 'vitest';
import {
  RECOVERY_CODE_LENGTH,
  formatRecoveryCode,
  isValidRecoveryCode,
  normaliseRecoveryCode,
  randomRecoveryCode,
} from './recoveryCode';
import { ALPHABET } from './roomCode';

describe('randomRecoveryCode', () => {
  test('draws only from the unambiguous alphabet', () => {
    // #given a hundred generated codes
    const codes = Array.from({ length: 100 }, () => randomRecoveryCode());

    // #when every character is checked against the alphabet
    const stray = codes.flatMap((code) => [...code]).filter((c) => !ALPHABET.includes(c));

    // #then none of them can be misread as another character
    expect(stray).toEqual([]);
  });

  test('is long enough to be worth guarding', () => {
    // #given a generated code
    const code = randomRecoveryCode();

    // #when its length is checked
    // #then it is the full eight, not a room code's four
    expect(code).toHaveLength(RECOVERY_CODE_LENGTH);
  });
});

describe('normaliseRecoveryCode', () => {
  test('accepts a code pasted back in the form it was shown', () => {
    // #given a code copied complete with the hyphen it is displayed with
    const typed = 'abcd-efgh';

    // #when it is normalised
    const code = normaliseRecoveryCode(typed);

    // #then the hyphen and the case are gone, and it is the stored form
    expect(code).toBe('ABCDEFGH');
  });

  test('drops characters outside the alphabet rather than guessing at them', () => {
    // #given input carrying an O and an I, which the alphabet omits
    const typed = 'ABCOEIGH';

    // #when it is normalised
    const code = normaliseRecoveryCode(typed);

    // #then they are dropped, leaving a code that fails the length check rather
    // than a wrong-but-valid one pointing at somebody else's identity
    expect(isValidRecoveryCode(code)).toBe(false);
  });
});

describe('isValidRecoveryCode', () => {
  test('rejects a code of the wrong length', () => {
    // #given a room code, which is the same alphabet but four characters
    // #when it is checked as a recovery code
    // #then it is refused
    expect(isValidRecoveryCode('HKQ7')).toBe(false);
  });

  test('accepts a freshly generated one', () => {
    // #given a generated code
    // #when it is checked
    // #then generation and validation agree
    expect(isValidRecoveryCode(randomRecoveryCode())).toBe(true);
  });
});

describe('formatRecoveryCode', () => {
  test('splits the code in half for reading aloud', () => {
    // #given a stored code
    // #when it is formatted for display
    const shown = formatRecoveryCode('ABCDEFGH');

    // #then it is grouped, and normalising it returns the stored form — the two
    // have to be exact inverses or a copied code will not claim anything
    expect(shown).toBe('ABCD-EFGH');
    expect(normaliseRecoveryCode(shown)).toBe('ABCDEFGH');
  });
});
