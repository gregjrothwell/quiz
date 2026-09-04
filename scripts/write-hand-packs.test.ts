import { describe, expect, test } from 'vitest';
import { HAND_BUILT_PACK_IDS } from '../src/questions/types';
import { mergeHandVault, mergeIndex, withStillsAttribution } from './write-hand-packs';

describe('mergeIndex', () => {
  test('keeps harvested packs and appends the hand-built ones', () => {
    const harvested = [
      {
        id: 'geography' as const,
        title: 'Geography',
        blurb: 'Places',
        count: 10,
        counts: { easy: 1, medium: 8, hard: 1 },
      },
    ];
    const hand = [
      {
        id: 'melody' as const,
        title: 'Name that Tune',
        blurb: 'Six tunes',
        count: 6,
        counts: { easy: 2, medium: 4, hard: 0 },
      },
    ];
    const merged = mergeIndex(harvested, hand);
    expect(merged.map((pack) => pack.id)).toEqual(['geography', 'melody']);
  });

  test('drops a harvested row that collides with a hand-built pack id', () => {
    const harvested = [
      {
        id: 'melody' as const,
        title: 'Wrong',
        blurb: 'Harvested by mistake',
        count: 99,
        counts: { easy: 0, medium: 99, hard: 0 },
      },
    ];
    const hand = [
      {
        id: 'melody' as const,
        title: 'Name that Tune',
        blurb: 'Six tunes',
        count: 6,
        counts: { easy: 2, medium: 4, hard: 0 },
      },
    ];
    expect(mergeIndex(harvested, hand)).toEqual(hand);
  });

  test('the hand-built ids are melody and picture', () => {
    expect(HAND_BUILT_PACK_IDS).toEqual(['melody', 'picture']);
  });
});

describe('withStillsAttribution', () => {
  test('appends the stills section without duplicating it', () => {
    const first = withStillsAttribution('# Trivia\n\nOpenTDB.\n', '## Picture-round stills\n\n- Hay Wain\n');
    const second = withStillsAttribution(first, '## Picture-round stills\n\n- Hay Wain\n- Temeraire\n');
    expect(second.match(/## Picture-round stills/g)).toHaveLength(1);
    expect(second).toContain('Temeraire');
  });
});

describe('mergeHandVault', () => {
  test('keeps existing keys and overlays new picture answers', () => {
    const merged = mergeHandVault(
      { melody1: 'Ode to Joy', oldStill: 'Hay Wain' },
      { newStill: 'The Kiss', oldStill: 'Hay Wain' },
    );
    expect(merged).toEqual({
      melody1: 'Ode to Joy',
      oldStill: 'Hay Wain',
      newStill: 'The Kiss',
    });
  });
});
