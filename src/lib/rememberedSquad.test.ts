import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  rememberPlayingWith,
  rememberSquad,
  rememberedPlayingWith,
  rememberedSquad,
} from './rememberedSquad';

const SQUAD_KEY = 'vibequiz.team';
const PLAYING_WITH_KEY = 'vibequiz.playingWith';

/**
 * A pair of storages good enough for these tests, or ones that refuse to be.
 * Same shape as `rememberedName.test.ts`, which is the module this one mirrors.
 */
function stubStorage(options: { throws?: boolean; squad?: string; playingWith?: string } = {}) {
  const local = new Map<string, string>();
  const session = new Map<string, string>();
  if (options.squad !== undefined) local.set(SQUAD_KEY, options.squad);
  if (options.playingWith !== undefined) session.set(PLAYING_WITH_KEY, options.playingWith);

  const build = (contents: Map<string, string>) => ({
    getItem: (key: string): string | null => {
      if (options.throws) throw new Error('access denied');
      return contents.get(key) ?? null;
    },
    setItem: (key: string, value: string): void => {
      if (options.throws) throw new Error('quota exceeded');
      contents.set(key, value);
    },
    removeItem: (key: string): void => {
      if (options.throws) throw new Error('access denied');
      contents.delete(key);
    },
  });

  vi.stubGlobal('window', { localStorage: build(local), sessionStorage: build(session) });
  return { local, session };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('rememberedSquad', () => {
  test('reads back a squad it was given', () => {
    // #given a browser that played for Hermes last time
    stubStorage({ squad: 'Hermes' });

    // #when the squad is read
    // #then the picker starts where the player left it
    expect(rememberedSquad()).toBe('Hermes');
  });

  test('ignores a value the picker no longer offers', () => {
    // #given a name stored during the free-text era, which one live record has
    stubStorage({ squad: 'Awesome team' });

    // #when the squad is read
    // #then nothing, so the player is asked to choose. A `<select>` handed a
    // value matching none of its options renders as though nothing were chosen,
    // and the picker would then silently disagree with the record
    expect(rememberedSquad()).toBe('');
  });

  test('ignores a spelling that is only nearly right', () => {
    // #given a lowercase value, which nothing writes but storage may hold
    stubStorage({ squad: 'hermes' });

    // #when the squad is read
    // #then it is not offered. The record keeps it — `cleanSquad` is what runs
    // on the way out of Firestore, and it is deliberately more tolerant
    expect(rememberedSquad()).toBe('');
  });

  test('reads no squad on a browser that has never chosen one', () => {
    // #given empty storage
    stubStorage();

    // #when the squad is read
    // #then nothing, which the banking rule treats as "keep what the record
    // says" rather than as "no squad"
    expect(rememberedSquad()).toBe('');
  });

  test('survives storage that refuses to be read', () => {
    // #given a private window or a locked-down profile
    stubStorage({ throws: true });

    // #when the squad is read
    // #then no squad rather than a crash on the landing screen
    expect(rememberedSquad()).toBe('');
  });
});

describe('rememberSquad', () => {
  test('stores a real squad', () => {
    // #given a browser with nothing stored
    const { local } = stubStorage();

    // #when a squad is chosen
    rememberSquad('Bundae');

    // #then it is kept for next time
    expect(local.get(SQUAD_KEY)).toBe('Bundae');
  });

  test('clears the key rather than storing an empty string', () => {
    // #given a browser that had a squad
    const { local } = stubStorage({ squad: 'Hermes' });

    // #when the player picks "not saying"
    rememberSquad('');

    // #then the key is gone, so nothing later reads an empty string as a choice
    expect(local.has(SQUAD_KEY)).toBe(false);
  });

  test('refuses to store a squad that is not on the list', () => {
    // #given a browser with nothing stored
    const { local } = stubStorage();

    // #when something outside the list arrives
    rememberSquad('Awesome team');

    // #then it is not kept — the picker cannot produce this, and storing it
    // would put back the value `rememberedSquad` exists to reject
    expect(local.has(SQUAD_KEY)).toBe(false);
  });

  test('survives storage that refuses to be written', () => {
    // #given storage that throws on every call
    stubStorage({ throws: true });

    // #when a squad is chosen
    // #then nothing is lost for this game: the round already has the value
    expect(() => rememberSquad('Hermes')).not.toThrow();
  });
});

describe('rememberedPlayingWith', () => {
  test('reads back who a Lurker sat with', () => {
    // #given a Lurker who chose Hermes for tonight
    stubStorage({ playingWith: 'Hermes' });

    // #when it is read
    // #then a reload keeps the choice rather than quietly reverting it
    expect(rememberedPlayingWith()).toBe('Hermes');
  });

  test('is nothing by default, so both boards agree', () => {
    // #given anybody who is not a Lurker
    stubStorage();

    // #when it is read
    // #then nothing, and the week row simply takes the season row's squad
    expect(rememberedPlayingWith()).toBe('');
  });

  test('is kept in session storage, not local', () => {
    // #given a fresh browser
    const { local, session } = stubStorage();

    // #when a Lurker says who they are with
    rememberPlayingWith('Bundae');

    // #then it lives only as long as the tab. Sitting with Bundae this week is
    // not a standing arrangement, and carrying it to next month would bank
    // somebody's points for a squad they were not with
    expect(session.get(PLAYING_WITH_KEY)).toBe('Bundae');
    expect(local.has(PLAYING_WITH_KEY)).toBe(false);
  });

  test('clears rather than storing an empty choice', () => {
    // #given a Lurker who had chosen a side
    const { session } = stubStorage({ playingWith: 'Hermes' });

    // #when they go back to playing on their own
    rememberPlayingWith('');

    // #then the key is gone
    expect(session.has(PLAYING_WITH_KEY)).toBe(false);
  });
});
