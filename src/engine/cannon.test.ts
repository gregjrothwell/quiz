import { describe, expect, it } from 'vitest';
import {
  MAX_LOADED,
  NOTHING_KILLED,
  SHOTS,
  TEST_SHOT,
  available,
  isLoaded,
  loadedShots,
  readKillSwitch,
  readLoaded,
  toLoaded,
  verdictId,
  type Shot,
} from './cannon';

const A: Shot = { id: 'alpha', title: 'Alpha', blurb: 'a' };
const B: Shot = { id: 'beta', title: 'Beta', blurb: 'b' };

describe('the Slop Cannon', () => {
  it('ships dark: nothing is registered live (B6)', () => {
    expect(SHOTS).toEqual([]);
    expect(TEST_SHOT.id.length).toBeLessThanOrEqual(32);
  });

  it('offers what the kill switch allows, and nothing when the switch could not be read (B2, C1, C3)', () => {
    expect(available([A, B], NOTHING_KILLED)).toEqual([A, B]);
    expect(available([A, B], { off: ['alpha'] })).toEqual([B]);
    expect(available([A, B], 'all')).toEqual([]);
  });

  it('bounds the room map as the rule does (B4)', () => {
    const ids = Array.from({ length: 12 }, (_, i) => `shot-${String(i)}`);
    expect(Object.keys(toLoaded(ids))).toHaveLength(MAX_LOADED);
    expect(toLoaded(['ok', 'Not OK', 'x'.repeat(33), ''])).toEqual({ ok: true });
  });

  it('reads the room field through the bounds, not on trust', () => {
    expect(readLoaded(undefined)).toEqual({});
    expect(readLoaded({ alpha: true, beta: 'yes', gamma: false })).toEqual({ alpha: true });
    expect(readLoaded(['alpha'])).toEqual({});
  });

  it('reads the kill switch: missing is nothing pulled, malformed is everything pulled', () => {
    expect(readKillSwitch(undefined)).toEqual(NOTHING_KILLED);
    expect(readKillSwitch({})).toEqual(NOTHING_KILLED);
    expect(readKillSwitch({ off: ['alpha'] })).toEqual({ off: ['alpha'] });
    expect(readKillSwitch({ off: 'alpha' })).toBe('all');
    expect(readKillSwitch({ off: [1] })).toBe('all');
  });

  it('runs a shot only while loaded, registered and not pulled — mid-round included (C1)', () => {
    const loaded = { alpha: true } as const;
    expect(isLoaded(loaded, [A], NOTHING_KILLED, 'alpha')).toBe(true);
    expect(isLoaded(loaded, [A], { off: ['alpha'] }, 'alpha')).toBe(false);
    expect(isLoaded(loaded, [A], 'all', 'alpha')).toBe(false);
    expect(isLoaded(loaded, [B], NOTHING_KILLED, 'alpha')).toBe(false);
    expect(isLoaded({}, [A], NOTHING_KILLED, 'alpha')).toBe(false);
  });

  it('still asks the room about a shot pulled mid-round: it was in the round', () => {
    expect(loadedShots({ beta: true, alpha: true }, [A, B])).toEqual([A, B]);
    expect(loadedShots({ gone: true }, [A, B])).toEqual([]);
  });

  it('keys a verdict per player per shot per round (D3)', () => {
    expect(verdictId('g-1', 'alpha', 'u1')).toBe('g-1_alpha_u1');
  });
});
