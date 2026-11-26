import { afterEach, describe, expect, test, vi } from 'vitest';
import type { RoundSettings } from '../engine/houseRound';
import { rememberedRound, rememberRound } from './rememberedRound';

/** How this device ran its last round. docs/decisions/house-round.md. */

const KEY = 'vibequiz.houseRound';

const LAST: RoundSettings = {
  count: 20,
  level: 'medium',
  durationSecs: 15,
  ending: 'standoff',
  steal: true,
  chaser: false,
};

/** Same shape as `rememberedSquad.test.ts`, which is the module this one mirrors. */
function stubStorage(options: { throws?: boolean; stored?: string } = {}) {
  const local = new Map<string, string>();
  const session = new Map<string, string>();
  if (options.stored !== undefined) local.set(KEY, options.stored);

  const build = (contents: Map<string, string>) => ({
    getItem: (key: string): string | null => {
      if (options.throws) throw new Error('access denied');
      return contents.get(key) ?? null;
    },
    setItem: (key: string, value: string): void => {
      if (options.throws) throw new Error('quota exceeded');
      contents.set(key, value);
    },
  });

  vi.stubGlobal('window', { localStorage: build(local), sessionStorage: build(session) });
  return { local, session };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('rememberedRound', () => {
  test('reads back the round it was given', () => {
    stubStorage();
    rememberRound(LAST);
    expect(rememberedRound()).toEqual(LAST);
  });

  test('is kept in local storage, so tomorrow’s room starts from it', () => {
    const { local, session } = stubStorage();
    rememberRound(LAST);
    expect(local.has(KEY)).toBe(true);
    expect(session.size).toBe(0);
  });

  test('keeps six settings and nothing else, whatever it is handed', () => {
    // #given a caller passing more than it should
    const { local } = stubStorage();
    const extra = { ...LAST, packId: 'science', double: true, jigsaw: true, shots: ['test-shot'] };

    // #when it is remembered
    rememberRound(extra);

    // #then the pack and The Double never reach storage (criterion 5)
    const stored: unknown = JSON.parse(local.get(KEY) ?? 'null');
    expect(Object.keys(stored as object).sort()).toEqual(['chaser', 'count', 'durationSecs', 'ending', 'level', 'steal']);
  });

  test('is nothing on a browser that has never run a round', () => {
    stubStorage();
    expect(rememberedRound()).toBeNull();
  });

  test('survives storage that refuses to be read', () => {
    stubStorage({ throws: true });
    expect(rememberedRound()).toBeNull();
  });

  test('survives storage that refuses to be written', () => {
    stubStorage({ throws: true });
    expect(() => rememberRound(LAST)).not.toThrow();
  });

  test.each(['', 'not json', '{"count":', 'null', '[]', '"ramp"'])('reads %j as nothing', (stored) => {
    stubStorage({ stored });
    expect(rememberedRound()).toBeNull();
  });

  test('ignores a value the lobby no longer offers, and keeps the rest', () => {
    stubStorage({ stored: JSON.stringify({ ...LAST, level: 'hard', count: 30 }) });
    expect(rememberedRound()).toEqual({ ...LAST, level: 'ramp', count: 15 });
  });
});
