import { describe, expect, test } from 'vitest';
import {
  HIGHER_CAP,
  HIGHER_FLOOR,
  higherOptions,
  higherQuestion,
  levelOfPair,
  mirrorDecoy,
  shownPence,
} from './higher-core';

/*
  Higher or Lower's arithmetic, on invented prices. Greg plays it blind, so
  nothing here is a real price. docs/decisions/higher-or-lower.md.
*/

describe('levelOfPair: how far apart the two prices are', () => {
  test('nothing under the floor: a near-tie another month could flip is not asked', () => {
    expect(HIGHER_FLOOR).toBe(1.1);
    expect(levelOfPair(1.05)).toBeNull();
    expect(levelOfPair(1.0999)).toBeNull();
  });

  test('closer is harder', () => {
    expect(levelOfPair(1.1)).toBe('hard');
    expect(levelOfPair(1.29)).toBe('hard');
    expect(levelOfPair(1.3)).toBe('medium');
    expect(levelOfPair(1.99)).toBe('medium');
    expect(levelOfPair(2)).toBe('easy');
    expect(levelOfPair(4)).toBe('easy');
  });

  test('nothing over the cap, so the mirrored price stays believable', () => {
    expect(HIGHER_CAP).toBe(4);
    expect(levelOfPair(4.01)).toBeNull();
  });
});

describe('shownPence: the shown price as the question gives it', () => {
  test('is rounded on the step its own size sets, so it carries no shop .99', () => {
    expect(shownPence(199)).toBe(200);
    expect(shownPence(87)).toBe(87);
    expect(shownPence(1_234)).toBe(1_250);
  });
});

describe('mirrorDecoy: the real price reflected about the shown one', () => {
  test('is as far below as the real one is above, and the other way round', () => {
    expect(mirrorDecoy(200, 300, 10)).toBe(130);
    expect(mirrorDecoy(200, 100, 10)).toBe(400);
  });
});

describe('higherOptions', () => {
  test('a dearer hidden item: its price is on Higher, the mirror on Lower', () => {
    expect(higherOptions(200, 300)).toEqual({ options: ['Higher, £3.00', 'Lower, £1.30'], correctIndex: 0 });
  });

  test('a cheaper hidden item: its price is on Lower, the mirror on Higher', () => {
    expect(higherOptions(200, 100)).toEqual({ options: ['Higher, £4.00', 'Lower, £1.00'], correctIndex: 1 });
  });

  test('the real price is rounded on the shown price\'s step, like the mirror', () => {
    // Shown £2.00 rounds on 10p, so a real £3.04 reads £3.00 and the mirror £1.30.
    expect(higherOptions(200, 304).options).toEqual(['Higher, £3.00', 'Lower, £1.30']);
  });

  test('pence stay pence', () => {
    expect(higherOptions(60, 90)).toEqual({ options: ['Higher, 90p', 'Lower, 40p'], correctIndex: 0 });
  });
});

describe('higherQuestion', () => {
  test('names the shown item, its rounded price and the month, then the hidden item', () => {
    expect(higherQuestion({ shown: 'a made-up thing', hidden: 'another made-up thing', shownPence: 199 })).toBe(
      'In August 2026, a made-up thing cost about £2.00. Does another made-up thing cost more or less?',
    );
  });
});
