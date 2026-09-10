import { describe, expect, test } from 'vitest';
import { FLAG_SPECS } from './hand-flags-data';
import { SCREEN_SPECS } from './hand-screens-data';
import { SLEEVE_SPECS } from './hand-sleeves-data';
import { TUNE_SPECS, TUNES_MIN_PACK } from './hand-tunes-data';

function assertPlayable(
  specs: { slug: string; correct: string; incorrect: string[] }[],
  min: number,
): void {
  expect(specs.length).toBeGreaterThanOrEqual(min);
  const slugs = specs.map((spec) => spec.slug);
  expect(new Set(slugs).size).toBe(slugs.length);
  for (const spec of specs) {
    expect(spec.incorrect).toHaveLength(3);
    const options = [spec.correct, ...spec.incorrect];
    expect(new Set(options).size).toBe(4);
  }
}

describe('hand-built media specs', () => {
  test('tunes cover three default rounds, unique slugs, four distinct options', () => {
    assertPlayable(TUNE_SPECS, TUNES_MIN_PACK);
  });

  test('flags cover three default rounds, unique slugs, four distinct options', () => {
    assertPlayable(FLAG_SPECS, 45);
    const codes = new Set(FLAG_SPECS.map((spec) => spec.code));
    expect(codes.has('gb-eng')).toBe(true);
    expect(codes.has('gb-sct')).toBe(true);
    expect(codes.has('gb-wls')).toBe(true);
    expect(codes.has('gb-nir')).toBe(true);
  });

  test('sleeves cover three default rounds, unique slugs, four distinct options', () => {
    assertPlayable(SLEEVE_SPECS, 45);
  });

  test('screens cover three default rounds, unique slugs, four distinct options', () => {
    assertPlayable(SCREEN_SPECS, 45);
  });

  test('every tune clip window fits inside Apple’s thirty seconds', () => {
    // #given the offsets the title audit wrote into the specs
    const clipped = TUNE_SPECS.filter(
      (spec) => spec.previewStart !== undefined || spec.previewSeconds !== undefined,
    );

    // #then each one names a real stretch of a 30-second preview. A start past
    // the end is a silent question; a cut past the end is a cut that never
    // fires, and both are a mistyped number rather than a measured one.
    for (const spec of clipped) {
      const start = spec.previewStart ?? 0;
      expect(start).toBeGreaterThanOrEqual(0);
      expect(start).toBeLessThan(22);
      if (spec.previewSeconds !== undefined) {
        // Eight seconds is the shortest clip `chooseClip` will hand back.
        expect(spec.previewSeconds).toBeGreaterThanOrEqual(8);
        expect(start + spec.previewSeconds).toBeLessThanOrEqual(30);
      }
    }
  });

  test('screens mix eras instead of a wall of pre-1990 classics', () => {
    const years = SCREEN_SPECS.map((spec) => spec.year);
    expect(years.filter((year) => year < 1990).length).toBeLessThanOrEqual(8);
    expect(years.filter((year) => year >= 2010).length).toBeGreaterThanOrEqual(20);
    expect(years.filter((year) => year >= 2020).length).toBeGreaterThanOrEqual(6);
  });
});
