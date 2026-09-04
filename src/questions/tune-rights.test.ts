import { describe, expect, test } from 'vitest';
import { MELODY_SPECS } from './melody-voices';
import {
  TUNE_RIGHTS_YEAR,
  latestPublicDomainDeathYear,
  tuneAllowed,
} from './tune-rights';

describe('tuneAllowed', () => {
  test('lets through a composer who died before 1956', () => {
    expect(tuneAllowed({ kind: 'composed', authorDied: 1934 })).toBe(true);
  });

  test('lets through a traditional tune', () => {
    expect(tuneAllowed({ kind: 'traditional' })).toBe(true);
  });

  test('lets through a composer who died in 1955, the 2026 frontier', () => {
    expect(tuneAllowed({ kind: 'composed', authorDied: 1955 })).toBe(true);
  });

  test('lets through The Charleston: Johnson 1955, lyricist Mack 1944', () => {
    expect(
      tuneAllowed({ kind: 'composed', authorDied: 1955, lyricistDied: 1944 }),
    ).toBe(true);
  });

  test('refuses Vaughan Williams (d. 1958)', () => {
    expect(tuneAllowed({ kind: 'composed', authorDied: 1958 })).toBe(false);
  });

  test('refuses a composer who died in 1956', () => {
    expect(tuneAllowed({ kind: 'composed', authorDied: 1956 })).toBe(false);
  });

  test('refuses a 1937 composer whose lyricist died in 1983', () => {
    expect(
      tuneAllowed({ kind: 'composed', authorDied: 1937, lyricistDied: 1983 }),
    ).toBe(false);
  });
});

describe('the 2026 cutoff formula', () => {
  test('in 2026, authors who died in 1955 or earlier are PD', () => {
    expect(latestPublicDomainDeathYear(2026)).toBe(1955);
  });

  test('in 2027, 1956 deaths become PD — do not encode them yet', () => {
    expect(latestPublicDomainDeathYear(2027)).toBe(1956);
  });

  test('TUNE_RIGHTS_YEAR is this calendar year, so the 1956 fixture is reviewed when the year rolls', () => {
    expect(TUNE_RIGHTS_YEAR).toBe(new Date().getFullYear());
  });
});

describe('the melody pack specs', () => {
  test('every published tune passes the 1956 test', () => {
    const refused = MELODY_SPECS.filter((spec) => !tuneAllowed(spec.rights));
    expect(refused.map((spec) => spec.slug)).toEqual([]);
  });

  test('Happy Birthday is not in the published specs', () => {
    expect(MELODY_SPECS.some((spec) => /birthday/i.test(spec.correct))).toBe(false);
  });

  test('has enough unique tunes for three default rounds', () => {
    expect(MELODY_SPECS.length).toBeGreaterThanOrEqual(45);
  });
});
