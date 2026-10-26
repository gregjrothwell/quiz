import { describe, expect, it } from 'vitest';
import {
  MAX_LOADED,
  NOTHING_KILLED,
  SHOTS,
  TEST_SHOT,
  askedOnFinal,
  cannonFires,
  available,
  isLoaded,
  isModeKey,
  modesToAsk,
  withModes,
  type AskedMode,
  loadedShots,
  readKillSwitch,
  readLoaded,
  toLoaded,
  verdictId,
  type Shot,
} from './cannon';
import { isNewMode } from '../questions/newRounds';

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

describe('Keep / Bin on new lobby modes (E)', () => {
  const none = {
    wagerEnabled: false,
    stealEnabled: false,
    chaserEnabled: false,
    standoffEnabled: false,
    jigsawEnabled: false,
    doubleEnabled: false,
    roundTwo: false,
  };
  const realSticker = (today: string) => (mode: AskedMode) => isNewMode(mode, today);

  it('asks about a mode the round used, while its sticker is on, and stops the day after (E1)', () => {
    const chaser = { ...none, chaserEnabled: true };
    expect(modesToAsk(chaser, realSticker('2026-11-05'))).toEqual(['mode-chaser']);
    expect(modesToAsk(chaser, realSticker('2026-11-06'))).toEqual([]);
  });

  it('asks nothing of a round played without one, or with one whose sticker is off', () => {
    expect(modesToAsk(none, () => true)).toEqual([]);
    expect(modesToAsk({ ...none, wagerEnabled: true }, realSticker('2026-10-26'))).toEqual([]);
  });

  it('asks about the Double at the end of the morning, not at half-time (E4)', () => {
    const roundOne = { ...none, doubleEnabled: true };
    expect(modesToAsk(roundOne, () => true)).toEqual([]);
    expect(modesToAsk({ ...roundOne, roundTwo: true }, () => true)).toEqual(['mode-double']);
  });

  it('reads every flag in E3, in a fixed order', () => {
    const all = {
      wagerEnabled: true,
      stealEnabled: true,
      chaserEnabled: true,
      standoffEnabled: true,
      jigsawEnabled: true,
      doubleEnabled: true,
      roundTwo: true,
    };
    expect(modesToAsk(all, () => true)).toEqual([
      'mode-stakes', 'mode-steal', 'mode-chaser', 'mode-standoff', 'mode-jigsaw', 'mode-double',
    ]);
  });

  it('puts shots first, so the bound of eight never drops one (E2)', () => {
    const shots = toLoaded(['a', 'b', 'c', 'd']);
    const modes = ['mode-stakes', 'mode-steal', 'mode-chaser', 'mode-standoff', 'mode-jigsaw', 'mode-double'];
    const loaded = withModes(shots, modes);
    expect(Object.keys(loaded)).toHaveLength(MAX_LOADED);
    expect(Object.keys(loaded).slice(0, 4)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('names a mode by its lobby button on Final, after the shots, and ignores a key it does not know (E5)', () => {
    expect(askedOnFinal({ 'mode-chaser': true, alpha: true, 'mode-nope': true }, [A])).toEqual([
      { id: 'alpha', title: 'Alpha' },
      { id: 'mode-chaser', title: 'Against Mr Fries' },
    ]);
  });

  it('keeps modes off the standings line, which names shots only', () => {
    expect(loadedShots({ 'mode-chaser': true }, [A])).toEqual([]);
    expect(isModeKey('mode-chaser')).toBe(true);
    expect(isModeKey('alpha')).toBe(false);
  });
});

describe('the cannon fires (F1)', () => {
  it('only on a first sight of a podium with something on the panel', () => {
    expect(cannonFires(1, true, true)).toBe(true);
    expect(cannonFires(0, true, true)).toBe(false);
    expect(cannonFires(1, false, true)).toBe(false);
    expect(cannonFires(1, true, false)).toBe(false);
  });
});
