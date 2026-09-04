import { describe, expect, test } from 'vitest';
import { STILL_SPECS } from './hand-picture-data';

const ROUND_LENGTH = 15;
const NEED = 3 * ROUND_LENGTH;

describe('picture stills supply', () => {
  test('has unique slugs', () => {
    const slugs = STILL_SPECS.map((spec) => spec.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  test('can fill three mixed rounds of 15 without a repeat', () => {
    expect(STILL_SPECS.length).toBeGreaterThanOrEqual(NEED);
  });

  test('can fill three jigsaw rounds of 15 without a repeat', () => {
    expect(STILL_SPECS.filter((spec) => spec.jigsaw).length).toBeGreaterThanOrEqual(NEED);
  });

  test('Salisbury is the only still that is not jigsaw-eligible', () => {
    const stillOnly = STILL_SPECS.filter((spec) => !spec.jigsaw).map((spec) => spec.slug);
    expect(stillOnly).toEqual(['salisbury']);
  });

  test('every still has three distinct distractors', () => {
    for (const spec of STILL_SPECS) {
      expect(spec.incorrect).toHaveLength(3);
      expect(new Set(spec.incorrect).size).toBe(3);
      expect(spec.incorrect).not.toContain(spec.correct);
    }
  });
});
