import { describe, expect, test } from 'vitest';
import { HAND_BUILT_PACK_IDS, PACK_IDS, packNeedsSound } from './types';

describe('packNeedsSound', () => {
  test('only the synth pack and the iTunes pack need the mute gate', () => {
    expect(packNeedsSound('melody')).toBe(true);
    expect(packNeedsSound('tunes')).toBe(true);
    expect(packNeedsSound('flags')).toBe(false);
    expect(packNeedsSound('picture')).toBe(false);
    expect(packNeedsSound('screens')).toBe(false);
    expect(packNeedsSound('music')).toBe(false);
  });
});

describe('PACK_IDS', () => {
  test('hand-built ids are a subset of the lobby list', () => {
    for (const id of HAND_BUILT_PACK_IDS) {
      expect(PACK_IDS).toContain(id);
    }
  });
});
