import { describe, expect, test } from 'vitest';
import { fixedDurationFor, HAND_BUILT_PACK_IDS, PACK_IDS, packNeedsSound } from './types';

describe('packNeedsSound', () => {
  test('only the packs that play a sound need the mute gate', () => {
    expect(packNeedsSound('melody')).toBe(true);
    expect(packNeedsSound('tunes')).toBe(true);
    // A song from the album arrives halfway through a sleeve. A muted player can
    // still answer from the cover, but would miss a clue the rest of the room
    // hears — Greg, 29 September 2026. See docs/decisions/sleeves-song.md.
    expect(packNeedsSound('sleeves')).toBe(true);
    expect(packNeedsSound('flags')).toBe(false);
    expect(packNeedsSound('picture')).toBe(false);
    expect(packNeedsSound('screens')).toBe(false);
    expect(packNeedsSound('music')).toBe(false);
  });
});

describe('fixedDurationFor', () => {
  test('Name that Tune is always played on ten seconds', () => {
    // Greg, 30 September 2026: on fifteen, round `SQ8V`'s clips sang their own
    // titles. Ten is enough music to place a song.
    expect(fixedDurationFor('tunes')).toBe(10);
  });

  test('every other pack keeps the lobby\'s choice', () => {
    for (const id of PACK_IDS) {
      if (id === 'tunes') continue;
      expect(fixedDurationFor(id)).toBeNull();
    }
  });
});

describe('PACK_IDS', () => {
  test('hand-built ids are a subset of the lobby list', () => {
    for (const id of HAND_BUILT_PACK_IDS) {
      expect(PACK_IDS).toContain(id);
    }
  });
});
