import { describe, expect, test } from 'vitest';
import {
  BONUS_EVERY,
  BONUS_MULTIPLIER,
  BONUS_SQUARES,
  isBonusCatchphrase,
  liftOrder,
  liftedSquareCount,
} from './catchphraseBonus';
import { optionsAtMs } from './optionsHold';

/**
 * Bonus Catchphrase: every fifth question, the picture under nine squares that
 * lift one every tenth of the clock. Story approved by Greg, 5 October 2026 —
 * docs/decisions/catchphrase-difficulty.md.
 */

const bonusesIn = (length: number): number =>
  Array.from({ length }, (_, index) => index).filter((index) =>
    isBonusCatchphrase('catchphrase', index),
  ).length;

describe('which questions are a Bonus Catchphrase', () => {
  test('the 5th, 10th, 15th, 20th and 25th', () => {
    expect(BONUS_EVERY).toBe(5);
    for (const index of [4, 9, 14, 19, 24]) {
      expect(isBonusCatchphrase('catchphrase', index)).toBe(true);
    }
    for (const index of [0, 1, 2, 3, 5, 8, 10, 13, 15, 23]) {
      expect(isBonusCatchphrase('catchphrase', index)).toBe(false);
    }
  });

  test('2 in a round of 10, 3 in 15, 4 in 20', () => {
    expect(bonusesIn(10)).toBe(2);
    expect(bonusesIn(15)).toBe(3);
    expect(bonusesIn(20)).toBe(4);
  });

  test('only in Catchphrase', () => {
    expect(isBonusCatchphrase('screens', 4)).toBe(false);
    expect(isBonusCatchphrase('sleeves', 9)).toBe(false);
    expect(isBonusCatchphrase(null, 4)).toBe(false);
  });
});

describe('how many squares have lifted', () => {
  test('one every tenth of a 15 s clock, whole from 13.5 s', () => {
    expect(BONUS_SQUARES).toBe(9);
    expect(liftedSquareCount(0, 15_000)).toBe(0);
    expect(liftedSquareCount(1_499, 15_000)).toBe(0);
    expect(liftedSquareCount(1_500, 15_000)).toBe(1);
    expect(liftedSquareCount(13_499, 15_000)).toBe(8);
    expect(liftedSquareCount(13_500, 15_000)).toBe(9);
    expect(liftedSquareCount(15_000, 15_000)).toBe(9);
  });

  test('never more than nine, never fewer than none', () => {
    expect(liftedSquareCount(60_000, 15_000)).toBe(9);
    expect(liftedSquareCount(-500, 15_000)).toBe(0);
    expect(liftedSquareCount(0, 0)).toBe(9);
  });

  test('five of the nine are up when the options land, on every clock', () => {
    for (const durationMs of [10_000, 15_000, 20_000]) {
      expect(liftedSquareCount(optionsAtMs('catchphrase', durationMs), durationMs)).toBe(5);
    }
  });
});

describe('the order they lift in', () => {
  test('is every square once', () => {
    const order = liftOrder('cp-007', 'game-1');
    expect([...order].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });

  test('is the same on every screen given the same question and game', () => {
    expect(liftOrder('cp-007', 'game-1')).toEqual(liftOrder('cp-007', 'game-1'));
  });

  test('changes from one game to the next', () => {
    const orders = new Set(
      ['game-1', 'game-2', 'game-3', 'game-4'].map((gameId) =>
        liftOrder('cp-007', gameId).join(','),
      ),
    );
    expect(orders.size).toBeGreaterThan(1);
  });
});

describe('what a bonus is worth', () => {
  test('double — Greg, 5 October 2026', () => {
    expect(BONUS_MULTIPLIER).toBe(2);
  });
});
