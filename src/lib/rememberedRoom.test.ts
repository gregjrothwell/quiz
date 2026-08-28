import { afterEach, describe, expect, test, vi } from 'vitest';
import { forgetRoom, rememberRoom, rememberedRoom } from './rememberedRoom';

const STORAGE_KEY = 'vibequiz.room';

/**
 * A session storage good enough for these tests, or one that refuses to be.
 * Same shape as `rememberedSquad.test.ts`, which is the module this one mirrors.
 */
function stubStorage(options: { throws?: boolean; room?: string } = {}) {
  const session = new Map<string, string>();
  if (options.room !== undefined) session.set(STORAGE_KEY, options.room);

  vi.stubGlobal('window', {
    sessionStorage: {
      getItem: (key: string): string | null => {
        if (options.throws) throw new Error('access denied');
        return session.get(key) ?? null;
      },
      setItem: (key: string, value: string): void => {
        if (options.throws) throw new Error('quota exceeded');
        session.set(key, value);
      },
      removeItem: (key: string): void => {
        if (options.throws) throw new Error('access denied');
        session.delete(key);
      },
    },
  });
  return session;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('rememberedRoom', () => {
  test('gives back the room this tab was in', () => {
    stubStorage({ room: '6JA5' });
    expect(rememberedRoom()).toBe('6JA5');
  });

  test('is empty when nothing is stored', () => {
    stubStorage();
    expect(rememberedRoom()).toBe('');
  });

  test('normalises what it finds, so a lowercase code still restores', () => {
    // Codes are written by this app, but a hand-edited one should behave the
    // same as one typed into the landing screen, which normalises.
    stubStorage({ room: '6ja5' });
    expect(rememberedRoom()).toBe('6JA5');
  });

  describe('refuses anything that is not a room code', () => {
    // What is in storage is whatever an older build wrote, or whatever somebody
    // with the console open decided to put there. An invalid code reads as no
    // code, which lands on the landing screen — where a fresh tab starts anyway.
    test.each([
      ['too short', '6JA'],
      ['too long', '6JA55'],
      ['a confusable character the alphabet omits', '6JA1'],
      ['empty', ''],
      ['junk', '{"a":1}'],
    ])('%s', (_why, stored) => {
      stubStorage({ room: stored });
      expect(rememberedRoom()).toBe('');
    });
  });

  test('a storage that throws reads as no room rather than crashing', () => {
    // Private windows and locked-down profiles throw on access.
    stubStorage({ throws: true });
    expect(rememberedRoom()).toBe('');
  });
});

describe('rememberRoom', () => {
  test('stores a valid code', () => {
    const session = stubStorage();
    rememberRoom('6JA5');
    expect(session.get(STORAGE_KEY)).toBe('6JA5');
  });

  test('stores nothing at all for an invalid code', () => {
    // Rather than storing junk that `rememberedRoom` would then have to reject.
    const session = stubStorage();
    rememberRoom('nope');
    expect(session.has(STORAGE_KEY)).toBe(false);
  });

  test('a storage that throws loses nothing that matters', () => {
    stubStorage({ throws: true });
    expect(() => rememberRoom('6JA5')).not.toThrow();
  });
});

describe('forgetRoom', () => {
  test('clears the stored room', () => {
    const session = stubStorage({ room: '6JA5' });
    forgetRoom();
    expect(session.has(STORAGE_KEY)).toBe(false);
  });

  test('leaving and reading back gives nothing', () => {
    // The whole risk in the feature, stated as a test: without this, Leave
    // drops you out of the room and the next render puts you straight back.
    stubStorage({ room: '6JA5' });
    expect(rememberedRoom()).toBe('6JA5');
    forgetRoom();
    expect(rememberedRoom()).toBe('');
  });

  test('a storage that throws does not break leaving', () => {
    stubStorage({ throws: true });
    expect(() => forgetRoom()).not.toThrow();
  });
});
