import { describe, expect, test } from 'vitest';
import {
  countOf,
  finalFor,
  finalsBoundsOk,
  finalsLine,
  withTonight,
  type FinalsTally,
} from './finals';
import type { Standoff } from './standoff';

function settled(picks: Standoff['picks']): Standoff {
  return {
    finalists: ['sam', 'greg'],
    stakes: { sam: 3_100, greg: 2_450 },
    stage: 'revealed',
    sealed: ['sam', 'greg'],
    picks,
  };
}

const HISTORY: FinalsTally = { finals: 7, shared: 5, shafted: 2, gotShafted: 2 };

describe('finalFor', () => {
  test('returns nothing when the final is not settled', () => {
    const talking = { ...settled(null), stage: 'talk' as const, picks: null };
    expect(finalFor(talking, 'sam')).toBeNull();
    expect(finalFor(null, 'sam')).toBeNull();
  });

  test('returns nothing for someone who was not in the final', () => {
    expect(finalFor(settled({ sam: 'share', greg: 'share' }), 'priya')).toBeNull();
  });

  test('reads the counted picks, and a missing one is a no-pick', () => {
    expect(finalFor(settled({ sam: 'shaft', greg: 'share' }), 'greg')).toEqual({
      pick: 'share',
      opponent: 'shaft',
    });
    expect(finalFor(settled({ sam: 'shaft', greg: null }), 'greg')).toEqual({
      pick: null,
      opponent: 'shaft',
    });
  });
});

describe('what a final counts as', () => {
  test('a no-pick does not count as a share', () => {
    expect(countOf({ pick: null, opponent: 'shaft' })).toEqual({
      finals: 1,
      shared: 0,
      shafted: 0,
      gotShafted: 1,
    });
  });

  test('both shafting is got shafted as well as shafted', () => {
    expect(countOf({ pick: 'shaft', opponent: 'shaft' })).toEqual({
      finals: 1,
      shared: 0,
      shafted: 1,
      gotShafted: 1,
    });
  });

  test('tonight is added on top of the record coming in', () => {
    const tonight = withTonight(HISTORY, { pick: 'shaft', opponent: 'share' });
    expect(tonight).toEqual({ finals: 8, shared: 5, shafted: 3, gotShafted: 2 });
    expect(withTonight(HISTORY, null)).toEqual(HISTORY);
  });
});

describe('finalsLine', () => {
  test('says First final for none, and 1 final for one', () => {
    expect(finalsLine({ finals: 0, shared: 0, shafted: 0, gotShafted: 0 })).toBe('First final');
    expect(finalsLine({ finals: 1, shared: 1, shafted: 0, gotShafted: 0 })).toBe(
      '1 final · shared 1 · shafted 0 · got shafted 0',
    );
  });

  test('shows the zeros, and a no-pick only when there is one', () => {
    expect(finalsLine(HISTORY)).toBe('7 finals · shared 5 · shafted 2 · got shafted 2');
    expect(finalsLine({ finals: 4, shared: 2, shafted: 1, gotShafted: 1 })).toBe(
      '4 finals · shared 2 · shafted 1 · got shafted 1 · no pick 1',
    );
  });
});

describe('finalsBoundsOk', () => {
  const row = { finals: 7, shared: 5, shafted: 2, gotShafted: 2 };

  test('accepts a tally inside the bounds, including a no-pick', () => {
    expect(finalsBoundsOk(8, row)).toBe(true);
    expect(finalsBoundsOk(4, { finals: 4, shared: 2, shafted: 1, gotShafted: 4 })).toBe(true);
  });

  test('refuses each bound the rules refuse', () => {
    expect(finalsBoundsOk(8, { ...row, finals: -1 })).toBe(false);
    expect(finalsBoundsOk(8, { ...row, shared: 1.5 })).toBe(false);
    expect(finalsBoundsOk(6, row)).toBe(false);
    expect(finalsBoundsOk(8, { ...row, shared: 6 })).toBe(false);
    expect(finalsBoundsOk(8, { ...row, gotShafted: 8 })).toBe(false);
  });
});
