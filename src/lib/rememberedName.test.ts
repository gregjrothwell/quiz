import { afterEach, describe, expect, test, vi } from 'vitest';
import { MAX_NAME_LENGTH, cleanName, rememberName, rememberedName } from './rememberedName';

/** A localStorage good enough for these tests, or one that refuses to be one. */
function stubStorage(options: { throws?: boolean; seed?: unknown } = {}) {
  const contents = new Map<string, string>();
  if (typeof options.seed === 'string') contents.set('vibequiz.name', options.seed);

  const storage = {
    getItem: (key: string): string | null => {
      if (options.throws) throw new Error('access denied');
      return contents.get(key) ?? null;
    },
    setItem: (key: string, value: string): void => {
      if (options.throws) throw new Error('quota exceeded');
      contents.set(key, value);
    },
  };

  vi.stubGlobal('window', { localStorage: storage });
  return contents;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('cleanName', () => {
  test('drops the spaces either side of a typed name', () => {
    // #given a name pasted in with whitespace around it
    const raw = '  Greg  ';

    // #when it is cleaned
    const clean = cleanName(raw);

    // #then only the name itself is kept
    expect(clean).toBe('Greg');
  });

  test('caps a name at the length the input allows, with no trailing space', () => {
    // #given a name longer than the field would have accepted
    const raw = `${'a'.repeat(MAX_NAME_LENGTH)} and then some more`;

    // #when it is cleaned
    const clean = cleanName(raw);

    // #then it is cut to the cap and does not end mid-gap
    expect(clean).toHaveLength(MAX_NAME_LENGTH);
    expect(clean).toBe(clean.trim());
  });

  test('treats whitespace and non-strings as no name at all', () => {
    // #given the shapes storage can hand back when nobody has played or
    // something else wrote the key
    const junk = ['   ', null, undefined, 42, { name: 'Greg' }];

    // #when each is cleaned
    const cleaned = junk.map(cleanName);

    // #then every one of them reads as empty
    expect(cleaned).toEqual(['', '', '', '', '']);
  });
});

describe('rememberedName', () => {
  test('gives back the name this browser last played under', () => {
    // #given a browser that has played before
    stubStorage();
    rememberName('Greg');

    // #when the landing screen asks who this is
    const name = rememberedName();

    // #then it is the name from last time
    expect(name).toBe('Greg');
  });

  test('cleans what it finds rather than trusting it', () => {
    // #given a stored value written by something other than this build
    stubStorage({ seed: `   ${'z'.repeat(MAX_NAME_LENGTH + 10)}   ` });

    // #when it is read back
    const name = rememberedName();

    // #then it is held to the same cap as a typed one
    expect(name).toHaveLength(MAX_NAME_LENGTH);
  });

  test('reads as nobody when storage refuses to be read', () => {
    // #given a private window, where touching localStorage throws
    stubStorage({ throws: true });

    // #when the landing screen asks who this is
    const name = rememberedName();

    // #then it gets an empty box rather than an exception
    expect(name).toBe('');
  });

  test('reads as nobody when there is no window at all', () => {
    // #given no browser, which is how the tests and any build step run
    // #when the landing screen asks who this is
    const name = rememberedName();

    // #then it is empty, and nothing has thrown
    expect(name).toBe('');
  });
});

describe('rememberName', () => {
  test('does not let a blank submission wipe a good name', () => {
    // #given a browser that already remembers somebody
    const contents = stubStorage();
    rememberName('Greg');

    // #when a blank name is offered
    rememberName('   ');

    // #then the name already there survives
    expect(contents.get('vibequiz.name')).toBe('Greg');
  });

  test('stores the cleaned name, not the raw one', () => {
    // #given a name typed with a stray trailing space
    const contents = stubStorage();

    // #when it is remembered
    rememberName('Greg ');

    // #then what lands in storage is what the leaderboard would show
    expect(contents.get('vibequiz.name')).toBe('Greg');
  });

  test('shrugs off storage that will not accept a write', () => {
    // #given a browser refusing writes, such as one out of quota
    stubStorage({ throws: true });

    // #when a name is remembered anyway
    // #then the round is not interrupted by it
    expect(() => rememberName('Greg')).not.toThrow();
  });
});
