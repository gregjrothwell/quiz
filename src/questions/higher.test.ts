import { describe, expect, test } from 'vitest';
import { RANDOM_SOURCES } from '../engine/randomRound';
import { fixedDurationFor, HAND_BUILT_PACK_IDS, PACK_IDS, PACK_META, packNeedsSound } from './types';

/*
  Higher or Lower in the lobby. Decided by Greg, 24 October 2026: a fixed ten
  seconds (D2), not in Random Round (D4). docs/decisions/higher-or-lower.md.
*/

describe('Higher or Lower', () => {
  test('is a hand-built pack in the lobby, called Higher or Lower', () => {
    expect(PACK_IDS).toContain('higher');
    expect(HAND_BUILT_PACK_IDS).toContain('higher');
    expect(PACK_META.higher.title).toBe('Higher or Lower');
  });

  test('is always played on ten seconds: a two-way call needs no more', () => {
    expect(fixedDurationFor('higher')).toBe(10);
  });

  test('needs no sound', () => {
    expect(packNeedsSound('higher')).toBe(false);
  });

  test('is not dealt into Random Round until Greg says', () => {
    expect(RANDOM_SOURCES).not.toContain('higher');
  });
});
