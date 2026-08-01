import { describe, expect, test } from 'vitest';
import {
  ROOM_CODE_LENGTH,
  codeFromHash,
  isValidRoomCode,
  joinLink,
  normaliseRoomCode,
  randomRoomCode,
} from './roomCode';

describe('randomRoomCode', () => {
  test('produces a code of the expected length', () => {
    // #given the default random source
    const code = randomRoomCode();

    // #when its length is checked
    const length = code.length;

    // #then it matches the configured length
    expect(length).toBe(ROOM_CODE_LENGTH);
  });

  test('never emits characters people confuse when reading aloud', () => {
    // #given many generated codes
    const codes = Array.from({ length: 500 }, () => randomRoomCode());

    // #when they are searched for ambiguous characters
    const offenders = codes.filter((code) => /[ILO01Z2]/.test(code));

    // #then none contain I, L, O, 0, 1, Z or 2
    expect(offenders).toEqual([]);
  });

  test('is driven entirely by the injected random source', () => {
    // #given a random source pinned to the first character
    const code = randomRoomCode(() => 0);

    // #when a code is generated
    const result = code;

    // #then every position takes the first letter of the alphabet
    expect(result).toBe('AAAA');
  });
});

describe('normaliseRoomCode', () => {
  test('uppercases and trims typed input', () => {
    // #given input with stray whitespace and lowercase letters
    const input = '  abcd  ';

    // #when it is normalised
    const result = normaliseRoomCode(input);

    // #then it is clean and uppercase
    expect(result).toBe('ABCD');
  });

  test('drops characters outside the alphabet rather than guessing', () => {
    // #given input containing an excluded character
    const input = 'AB0D';

    // #when it is normalised
    const result = normaliseRoomCode(input);

    // #then the character is removed, so the code fails length validation
    // instead of silently resolving to a different room
    expect(result).toBe('ABD');
  });
});

describe('isValidRoomCode', () => {
  test('accepts a well-formed code', () => {
    // #given a code of the right length and alphabet
    const input = 'ABCD';

    // #when it is validated
    const result = isValidRoomCode(input);

    // #then it passes
    expect(result).toBe(true);
  });

  test('rejects a code of the wrong length', () => {
    // #given a code one character short
    const input = 'ABC';

    // #when it is validated
    const result = isValidRoomCode(input);

    // #then it fails
    expect(result).toBe(false);
  });

  test('rejects a code containing an excluded character', () => {
    // #given a code using the excluded letter O
    const input = 'ABCO';

    // #when it is validated
    const result = isValidRoomCode(input);

    // #then it fails
    expect(result).toBe(false);
  });
});

describe('codeFromHash', () => {
  test('reads the code out of a join link', () => {
    // #given the hash a QR code lands on
    const hash = '#/j/HKQ7';

    // #when it is parsed
    const result = codeFromHash(hash);

    // #then the code comes back ready to use
    expect(result).toBe('HKQ7');
  });

  test('normalises a code typed in lower case', () => {
    // #given a link somebody retyped by hand
    const hash = '#/j/hkq7';

    // #when it is parsed
    const result = codeFromHash(hash);

    // #then it is upper-cased to match a real room code
    expect(result).toBe('HKQ7');
  });

  test('ignores a hash that is not a join link', () => {
    // #given the design gallery's hash
    const hash = '#/preview/4';

    // #when it is parsed
    const result = codeFromHash(hash);

    // #then nothing is prefilled
    expect(result).toBeNull();
  });

  test('rejects a link carrying an impossible code', () => {
    // #given a link whose code uses an excluded character
    const hash = '#/j/ABCO';

    // #when it is parsed
    const result = codeFromHash(hash);

    // #then it is refused rather than half-filling the field
    expect(result).toBeNull();
  });

  test('rejects a link carrying a short code', () => {
    // #given a truncated link
    const hash = '#/j/AB';

    // #when it is parsed
    const result = codeFromHash(hash);

    // #then it is refused
    expect(result).toBeNull();
  });
});

describe('joinLink', () => {
  test('builds a link under the deployed base path', () => {
    // #given the app served from a subdirectory, as GitHub Pages does
    const origin = 'https://gregjrothwell.github.io';
    const basePath = '/quiz/';

    // #when a link is built for a room
    const result = joinLink(origin, basePath, 'HKQ7');

    // #then it round-trips back to the same code
    expect(result).toBe('https://gregjrothwell.github.io/quiz/#/j/HKQ7');
    expect(codeFromHash(new URL(result).hash)).toBe('HKQ7');
  });
});
