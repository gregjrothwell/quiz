import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { TAG_SPECS, TAGS_MIN_PER_LEVEL, type TagSpec } from './hand-tags-data';
import { MIN_SPACING } from './prices-core';
import { stableId } from './write-hand-packs';
import { DIFFICULTIES } from '../src/questions/types';

/*
  The Price is Right as published: `public/packs/tags.json`. The arithmetic is
  tested on invented prices in `write-tags-pack.test.ts`; this checks the file
  was rebuilt with the specs and keeps the rules a player can see without the
  vault — order, pictures, levels, spacing, and the spread of prices.

  Greg plays it blind, and the published pack holds real prices, so every
  assertion compares ids and counts: a failure names the question, never what
  it shows. The fixtures for the deny cases are invented.
*/

interface Shown {
  id: string;
  options: string[];
  difficulty: string;
  image?: string;
  ordered?: boolean;
}

const PACK_DIR = join(import.meta.dirname, '..', 'public', 'packs');
const PACK = JSON.parse(readFileSync(join(PACK_DIR, 'tags.json'), 'utf8')) as { questions: Shown[] };

function pence(option: string): number {
  return option.endsWith('p') ? Number(option.slice(0, -1)) : Math.round(Number(option.replace(/[£,]/g, '')) * 100);
}

/** Specs whose question is not in its place, and ids the specs do not account for. */
function outOfStep(questions: readonly Shown[], specs: readonly TagSpec[]): string[] {
  const shipping = specs.filter((spec) => spec.dropped === undefined);
  const missing = shipping.filter((spec, i) => questions[i]?.id !== stableId(spec.slug)).map((spec) => spec.slug);
  return [...missing, ...questions.slice(shipping.length).map((question) => question.id)];
}

/** Ids whose options are not low to high, at least `MIN_SPACING` apart. */
function badLadders(questions: readonly Shown[]): string[] {
  return questions
    .filter((question) => {
      const values = question.options.map(pence);
      return values.length !== 4 || values.some((value, i) => i > 0 && value / (values[i - 1] as number) < MIN_SPACING - 1e-9);
    })
    .map((question) => question.id);
}

/** Questions whose four options are all under `under` pence, and all over `over`. */
function spread(questions: readonly Shown[], under: number, over: number): { cheap: number; dear: number } {
  return {
    cheap: questions.filter((question) => question.options.every((option) => pence(option) < under)).length,
    dear: questions.filter((question) => question.options.every((option) => pence(option) > over)).length,
  };
}

describe('tags.json', () => {
  test('one question per spec, in the specs order', () => {
    expect(outOfStep(PACK.questions, TAG_SPECS)).toEqual([]);
  });

  test('the order rule refuses a pack built from other specs (deny case)', () => {
    expect(outOfStep(PACK.questions.slice(1), TAG_SPECS).length).toBeGreaterThan(0);
  });

  test('every question has a published picture and keeps its order', () => {
    const missing = PACK.questions.filter(
      (question) => !question.image || !existsSync(join(PACK_DIR, 'images', question.image)) || question.ordered !== true,
    );
    expect(missing.map((question) => question.id)).toEqual([]);
  });

  test('four options low to high, at least 12% apart', () => {
    expect(badLadders(PACK.questions)).toEqual([]);
    expect(badLadders([{ id: 'invented', options: ['£1', '£1.05', '£2', '£3'], difficulty: 'easy' }])).toEqual(['invented']);
  });

  test('at least 15 at each level', () => {
    for (const level of DIFFICULTIES) {
      expect(PACK.questions.filter((question) => question.difficulty === level).length, level).toBeGreaterThanOrEqual(
        TAGS_MIN_PER_LEVEL,
      );
    }
  });

  test('pocket money to big-ticket: ten questions wholly under £10 and ten wholly over £100', () => {
    const { cheap, dear } = spread(PACK.questions, 1_000, 10_000);
    expect(cheap).toBeGreaterThanOrEqual(10);
    expect(dear).toBeGreaterThanOrEqual(10);
    expect(spread([{ id: 'x', options: ['£5', '£7', '£9', '£11'], difficulty: 'easy' }], 1_000, 10_000).cheap).toBe(0);
  });
});
