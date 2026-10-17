import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { GAPS, PRICE_SPECS, PRICES_MIN_PER_GAP, PRICES_MIN_PER_LEVEL, type PriceSpec } from './hand-prices-data';
import { MIN_SPACING } from './prices-core';
import { stableId } from './write-hand-packs';
import { DIFFICULTIES } from '../src/questions/types';

/*
  The Price Was Right as published: `public/packs/prices.json`. The arithmetic
  is tested on invented prices in `write-prices-pack.test.ts`; this checks the
  file was rebuilt with the specs, and keeps the rules a player can see without
  the vault — gaps, levels, order, spacing and today's price.

  Greg plays it blind, and the published pack holds real prices, so every
  assertion on it compares ids and counts: a failure names the question, never
  what it shows. The fixtures for the deny cases are invented.
*/

interface Shown {
  id: string;
  question: string;
  options: string[];
  category: string;
  difficulty: string;
}

const PACK = JSON.parse(
  readFileSync(join(import.meta.dirname, '..', 'public', 'packs', 'prices.json'), 'utf8'),
) as { questions: Shown[] };

function pence(option: string): number {
  return option.endsWith('p') ? Number(option.slice(0, -1)) : Math.round(Number(option.replace(/[£,]/g, '')) * 100);
}

/** Slugs whose question is not in its place in the pack, and ids the specs do not account for. */
function outOfStep(questions: readonly Shown[], specs: readonly PriceSpec[]): string[] {
  const missing = specs.filter((spec, i) => questions[i]?.id !== stableId(spec.slug)).map((spec) => spec.slug);
  return [...missing, ...questions.slice(specs.length).map((question) => question.id)];
}

/** Questions whose options do not rise, low to high, at least `MIN_SPACING` apart. */
function unevenly(questions: readonly Shown[]): string[] {
  return questions
    .filter((question) => {
      const values = question.options.map(pence);
      return values.length !== 4 || values.some((value, i) => i > 0 && value / (values[i - 1] as number) < MIN_SPACING);
    })
    .map((question) => question.id);
}

/**
 * Questions with an option at or over the price they give anywhere but on
 * top, or more than one: the 7 October rule, which the answer and the decoys
 * both keep — none over today's price, or only the top option.
 */
function overToday(questions: readonly Shown[]): string[] {
  return questions
    .filter((question) => {
      const shown = /cost about (£[\d,]+(?:\.\d+)?|\d+p)\./.exec(question.question)?.[1];
      if (!shown) return true;
      const over = question.options.flatMap((option, i) => (pence(option) >= pence(shown) ? [i] : []));
      return !(over.length === 0 || (over.length === 1 && over[0] === 3));
    })
    .map((question) => question.id);
}

/** An invented question, in the published shape. */
function made(id: string, options: string[], today = '£2'): Shown {
  return {
    id,
    question: `In August 2026, a made-up thing cost about ${today}. What did it cost in August 2021?`,
    options,
    category: '5 years ago',
    difficulty: 'hard',
  };
}

describe('the published prices pack', () => {
  test('has one question per spec, in the specs\' order — rebuilt whenever they change', () => {
    expect(outOfStep(PACK.questions, PRICE_SPECS)).toEqual([]);
  });

  test('every gap and every level at least fifteen times', () => {
    for (const gap of Object.keys(GAPS)) {
      expect(PACK.questions.filter((q) => q.category === `${gap} years ago`).length).toBeGreaterThanOrEqual(
        PRICES_MIN_PER_GAP,
      );
    }
    for (const level of DIFFICULTIES) {
      expect(PACK.questions.filter((q) => q.difficulty === level).length).toBeGreaterThanOrEqual(PRICES_MIN_PER_LEVEL);
    }
  });

  test('shows four options low to high, at least the minimum spacing apart', () => {
    expect(unevenly(PACK.questions)).toEqual([]);
  });

  test('has an option at or over today\'s price only on top, and never two', () => {
    expect(overToday(PACK.questions)).toEqual([]);
  });
});

describe('the checks on it refuse what they should', () => {
  const specs = PRICE_SPECS.slice(0, 2);
  const questions = specs.map((spec) => made(stableId(spec.slug), []));

  test('a spec added without rebuilding the pack, or a question the specs no longer hold', () => {
    const extra: PriceSpec = { slug: 'price-999', gap: 5, key: '999999', name: 'a made-up thing', kind: 'home' };
    expect(outOfStep(questions, [...specs, extra])).toEqual(['price-999']);
    expect(outOfStep(questions, specs.slice(0, 1))).toEqual([questions[1]?.id]);
    expect(outOfStep(questions, specs)).toEqual([]);
  });

  test('options too close together, or out of order', () => {
    expect(unevenly([made('close', ['£1', '£1.05', '£1.50', '£1.80'])])).toEqual(['close']);
    expect(unevenly([made('order', ['£1.50', '£1', '£1.20', '£1.80'])])).toEqual(['order']);
    expect(unevenly([made('fine', ['£1', '£1.20', '£1.50', '£1.80'])])).toEqual([]);
  });

  test('two options over today\'s price, or one that is not on top', () => {
    expect(overToday([made('two', ['£1', '£1.50', '£2', '£3'])])).toEqual(['two']);
    expect(overToday([made('three', ['50p', '£1', '£1.50', '£1.80'], '75p')])).toEqual(['three']);
    expect(overToday([made('below', ['£1', '£3', '£1.20', '£1.50'])])).toEqual(['below']);
    expect(overToday([made('top', ['£1', '£1.20', '£1.50', '£2.50'])])).toEqual([]);
    expect(overToday([made('none', ['£1', '£1.20', '£1.50', '£1.80'])])).toEqual([]);
  });
});
