import { describe, expect, test } from 'vitest';
import { OPTIONS_HOLD_SHARE, optionsAtMs, optionsDue } from './optionsHold';

describe('when a question shows its options', () => {
  test('a Catchphrase picture plays alone for half the clock', () => {
    expect(OPTIONS_HOLD_SHARE).toBe(0.5);
    expect(optionsAtMs('catchphrase', 10_000)).toBe(5_000);
    expect(optionsAtMs('catchphrase', 15_000)).toBe(7_500);
  });

  test('every other pack shows its options from the first frame', () => {
    expect(optionsAtMs('screens', 10_000)).toBe(0);
    expect(optionsAtMs('sleeves', 10_000)).toBe(0);
    expect(optionsAtMs('general-knowledge', 10_000)).toBe(0);
    expect(optionsAtMs(null, 10_000)).toBe(0);
  });

  test('they are due at the moment itself, not a tick after', () => {
    expect(optionsDue(4_999, 5_000)).toBe(false);
    expect(optionsDue(5_000, 5_000)).toBe(true);
    expect(optionsDue(0, 0)).toBe(true);
  });
});
