import { describe, expect, test } from 'vitest';
import {
  JIGSAW_TILES,
  placementAfterSettles,
  scrambleTiles,
  settledTileCount,
} from './jigsaw';

describe('scrambleTiles', () => {
  test('is identical for the same question and game', () => {
    const a = scrambleTiles('q-hay', 'game-1');
    const b = scrambleTiles('q-hay', 'game-1');
    expect(a).toEqual(b);
  });

  test('differs when the game differs', () => {
    const a = scrambleTiles('q-hay', 'game-1');
    const b = scrambleTiles('q-hay', 'game-2');
    expect(a).not.toEqual(b);
  });

  test('is a permutation of 0..8', () => {
    const perm = scrambleTiles('q-wave', 'game-9');
    expect([...perm].sort((x, y) => x - y)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });
});

describe('settledTileCount', () => {
  test('starts scrambled and finishes home', () => {
    expect(settledTileCount(0, 10_000)).toBe(0);
    expect(settledTileCount(10_000, 10_000)).toBe(JIGSAW_TILES);
  });

  test('is linear across the window', () => {
    expect(settledTileCount(5_000, 9_000)).toBe(5);
  });
});

describe('placementAfterSettles', () => {
  test('is a permutation at every step', () => {
    const initial = scrambleTiles('q-scream', 'game-3');
    for (let settled = 0; settled <= JIGSAW_TILES; settled += 1) {
      const placed = placementAfterSettles(initial, settled);
      expect([...placed].sort((x, y) => x - y)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    }
  });

  test('is identity once every tile has settled', () => {
    const initial = scrambleTiles('q-marble', 'game-4');
    expect(placementAfterSettles(initial, JIGSAW_TILES)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });
});
