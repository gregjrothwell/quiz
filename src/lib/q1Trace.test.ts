import { afterEach, describe, expect, test, vi } from 'vitest';
import { windowSize } from './q1Trace';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('windowSize', () => {
  test('is what the browser says, each figure from its own property', () => {
    vi.stubGlobal('window', { innerWidth: 1_366, innerHeight: 657, devicePixelRatio: 1.25 });

    expect(windowSize()).toEqual({ width: 1_366, height: 657, pixelRatio: 1.25 });
  });

  test('zero is a reading', () => {
    vi.stubGlobal('window', { innerWidth: 0, innerHeight: 0, devicePixelRatio: 0 });

    expect(windowSize()).toEqual({ width: 0, height: 0, pixelRatio: 0 });
  });

  // NaN would reach Firestore as a float, which the rules refuse, and one
  // missing figure would cost the whole trace.
  test.each([undefined, null, Number.NaN, Number.POSITIVE_INFINITY, '1366'])(
    'a figure that is not a number (%s) is null, and the others stand',
    (odd) => {
      vi.stubGlobal('window', { innerWidth: odd, innerHeight: 657, devicePixelRatio: odd });

      expect(windowSize()).toEqual({ width: null, height: 657, pixelRatio: null });
    },
  );

  test('no window at all is three nulls rather than a throw', () => {
    vi.stubGlobal('window', undefined);

    expect(windowSize()).toEqual({ width: null, height: null, pixelRatio: null });
  });
});
