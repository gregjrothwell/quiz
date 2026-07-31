import { describe, expect, test } from 'vitest';
import { ROOM_CODE_LENGTH, isValidRoomCode, normaliseRoomCode, randomRoomCode } from './roomCode';

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
