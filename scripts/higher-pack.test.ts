import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { HIGHER_MAX_SHOWN_USES, HIGHER_MIN_PACK, HIGHER_MIN_PER_LEVEL, HIGHER_SPECS, type HigherSpec } from './hand-higher-data';
import { levelOfPair, mirrorDecoy } from './higher-core';
import { PRICE_SPECS, SPOILED_KEYS } from './hand-prices-data';
import { TAG_SPECS } from './hand-tags-data';
import { stepPence } from './prices-core';
import { stableId } from './write-hand-packs';
import { DIFFICULTIES } from '../src/questions/types';

/*
  Higher or Lower: the specs, and the pack as published. Greg plays it blind
  and the pack holds real prices, so every assertion here compares slugs, ids
  and counts: a failure names the question, never what it shows. Fixtures for
  the deny cases are invented. docs/decisions/higher-or-lower.md.

  Which option is right is not in the published file, by design, so these
  checks are the ones that hold whichever it is. The balance of Higher against
  Lower is the builder's to refuse (`write-higher-pack.test.ts`).
*/

interface Shown {
  id: string;
  question: string;
  options: string[];
  difficulty: string;
  ordered?: boolean;
}

function packAt(name: string): { questions: Shown[] } {
  return JSON.parse(readFileSync(join(import.meta.dirname, '..', 'public', 'packs', name), 'utf8')) as {
    questions: Shown[];
  };
}

function pence(price: string): number {
  return price.endsWith('p') ? Number(price.slice(0, -1)) : Math.round(Number(price.replace(/[£,]/g, '')) * 100);
}

/**
 * Specs whose hidden item could be answered from somewhere else: shown as a
 * card anywhere, hidden twice (its real price is then the one value both
 * questions share), in either price pack, or spoiled. And specs whose shown
 * card is The Price is Right's answer, or spoiled. A Price Was Right item as
 * a shown card is fine: its August 2026 price is already in its pack.
 */
function leaky(specs: readonly HigherSpec[]): string[] {
  const shown = new Set(specs.map((spec) => spec.shown.key));
  const hiddenUses = new Map<string, number>();
  for (const spec of specs) hiddenUses.set(spec.hidden.key, (hiddenUses.get(spec.hidden.key) ?? 0) + 1);
  const priced = new Set(PRICE_SPECS.map((spec) => spec.key));
  const tagged = new Set(TAG_SPECS.map((spec) => spec.key));
  const spoiled = new Set(SPOILED_KEYS);
  return specs
    .filter(({ shown: card, hidden }) => {
      const hiddenLeaks =
        shown.has(hidden.key) ||
        (hiddenUses.get(hidden.key) ?? 0) > 1 ||
        priced.has(hidden.key) ||
        tagged.has(hidden.key) ||
        spoiled.has(hidden.key);
      return hiddenLeaks || tagged.has(card.key) || spoiled.has(card.key);
    })
    .map((spec) => spec.slug);
}

/** Specs whose hidden item is named in another question here, or in either price pack. */
function namedElsewhere(specs: readonly HigherSpec[], elsewhere: readonly string[]): string[] {
  return specs
    .filter((spec, i) => {
      const name = spec.hidden.name.toLowerCase();
      const others = specs.filter((_, j) => j !== i).flatMap((other) => [other.shown.name, other.hidden.name]);
      return [...others, ...elsewhere].some((text) => text.toLowerCase().includes(name));
    })
    .map((spec) => spec.slug);
}

/** Specs that break variety: a shown card used too often, or a pair asked twice either way round. */
function samey(specs: readonly HigherSpec[]): string[] {
  const uses = new Map<string, number>();
  const pairs = new Set<string>();
  const out: string[] = [];
  for (const spec of specs) {
    uses.set(spec.shown.key, (uses.get(spec.shown.key) ?? 0) + 1);
    const pair = [spec.shown.key, spec.hidden.key].sort().join('|');
    if ((uses.get(spec.shown.key) ?? 0) > HIGHER_MAX_SHOWN_USES || pairs.has(pair)) out.push(spec.slug);
    pairs.add(pair);
  }
  return out;
}

/** Slugs whose question is not in its place in the pack, and ids the specs do not account for. */
function outOfStep(questions: readonly Shown[], specs: readonly HigherSpec[]): string[] {
  const missing = specs.filter((spec, i) => questions[i]?.id !== stableId(spec.slug)).map((spec) => spec.slug);
  return [...missing, ...questions.slice(specs.length).map((question) => question.id)];
}

/**
 * Questions that do not read *Higher, £x* over the shown price then *Lower,
 * £y* under it, in order; whose two prices are not each other's mirror about
 * the shown one, on its step — the tell a nearer or rounder decoy would be;
 * or whose level is not the one their spread reads as.
 */
function misshapen(questions: readonly Shown[]): string[] {
  return questions
    .filter((question) => {
      const given = /cost about (£[\d,]+(?:\.\d+)?|\d+p)\./.exec(question.question)?.[1];
      const higher = /^Higher, (£[\d,]+(?:\.\d+)?|\d+p)$/.exec(question.options[0] ?? '')?.[1];
      const lower = /^Lower, (£[\d,]+(?:\.\d+)?|\d+p)$/.exec(question.options[1] ?? '')?.[1];
      if (!given || !higher || !lower || question.options.length !== 2 || question.ordered !== true) return true;
      const [s, h, l] = [pence(given), pence(higher), pence(lower)];
      if (!(h > s && s > l)) return true;
      const step = stepPence(s);
      const mirrored = mirrorDecoy(s, h, step) === l || mirrorDecoy(s, l, step) === h;
      return !mirrored || levelOfPair(Math.sqrt(h / l)) !== question.difficulty;
    })
    .map((question) => question.id);
}

/** An invented spec. */
function spec(slug: string, shown: string, hidden: string, hiddenName = `the thing hidden in ${slug}`): HigherSpec {
  return { slug, shown: { key: shown, name: `the thing shown in ${slug}` }, hidden: { key: hidden, name: hiddenName } };
}

/** An invented question, in the published shape. */
function made(id: string, given: string, options: string[], difficulty = 'easy'): Shown {
  return {
    id,
    question: `In August 2026, a made-up thing cost about ${given}. Does another made-up thing cost more or less?`,
    options,
    difficulty,
    ordered: true,
  };
}

describe('the specs', () => {
  test('have unique slugs, enough of them, and only shop-quote keys', () => {
    expect(new Set(HIGHER_SPECS.map((s) => s.slug)).size).toBe(HIGHER_SPECS.length);
    expect(HIGHER_SPECS.length).toBeGreaterThanOrEqual(HIGHER_MIN_PACK);
    const notQuotes = HIGHER_SPECS.filter((s) => !/^\d{6}$/.test(s.shown.key) || !/^\d{6}$/.test(s.hidden.key));
    expect(notQuotes.map((s) => s.slug)).toEqual([]);
  });

  test('no hidden item can be answered from anywhere else', () => {
    expect(leaky(HIGHER_SPECS)).toEqual([]);
  });

  test('no hidden item is named in another question, here or in either price pack', () => {
    const elsewhere = [...packAt('prices.json').questions, ...packAt('tags.json').questions].map((q) => q.question);
    expect(namedElsewhere(HIGHER_SPECS, elsewhere)).toEqual([]);
  });

  test('variety: a shown card at most twice, and no pair asked twice', () => {
    expect(samey(HIGHER_SPECS)).toEqual([]);
  });
});

describe('the published pack', () => {
  const pack = packAt('higher.json');

  test('has one question per spec, in the specs\' order — rebuilt whenever they change', () => {
    expect(outOfStep(pack.questions, HIGHER_SPECS)).toEqual([]);
  });

  test('every level at least fifteen times', () => {
    for (const level of DIFFICULTIES) {
      expect(pack.questions.filter((q) => q.difficulty === level).length).toBeGreaterThanOrEqual(HIGHER_MIN_PER_LEVEL);
    }
  });

  test('Higher then Lower, either side of the shown price, mirrored, at the level their spread reads as', () => {
    expect(misshapen(pack.questions)).toEqual([]);
  });
});

describe('the checks on it refuse what they should', () => {
  const priceKey = PRICE_SPECS.find((s) => /^\d{6}$/.test(s.key))?.key as string;
  const tagKey = TAG_SPECS[0]?.key as string;

  test('allow: a Price Was Right item as a shown card, with an unused hidden item', () => {
    expect(leaky([spec('higher-901', priceKey, '999001')])).toEqual([]);
  });

  test('a hidden item that is shown elsewhere, hidden twice, priced, tagged or spoiled', () => {
    expect(leaky([spec('higher-901', '999001', '999002'), spec('higher-902', '999002', '999003')])).toEqual([
      'higher-901',
    ]);
    expect(leaky([spec('higher-901', '999001', '999003'), spec('higher-902', '999002', '999003')])).toEqual([
      'higher-901',
      'higher-902',
    ]);
    expect(leaky([spec('higher-901', '999001', priceKey)])).toEqual(['higher-901']);
    expect(leaky([spec('higher-901', '999001', tagKey)])).toEqual(['higher-901']);
    expect(leaky([spec('higher-901', '999001', SPOILED_KEYS[0] as string)])).toEqual(['higher-901']);
  });

  test('a shown card that is The Price is Right\'s answer, or spoiled', () => {
    expect(leaky([spec('higher-901', tagKey, '999001')])).toEqual(['higher-901']);
    expect(leaky([spec('higher-901', SPOILED_KEYS[1] as string, '999001')])).toEqual(['higher-901']);
  });

  test('a hidden item named elsewhere', () => {
    const specs = [spec('higher-901', '999001', '999002', 'a made-up gadget')];
    expect(namedElsewhere(specs, ['In August 2026, a made-up gadget cost about £3.'])).toEqual(['higher-901']);
    expect(namedElsewhere(specs, ['In August 2026, a made-up widget cost about £3.'])).toEqual([]);
  });

  test('a shown card used three times, or a pair asked twice either way round', () => {
    const thrice = ['999002', '999003', '999004'].map((hidden, i) => spec(`higher-90${i + 1}`, '999001', hidden));
    expect(samey(thrice)).toEqual(['higher-903']);
    expect(samey([spec('higher-901', '999001', '999002'), spec('higher-902', '999002', '999001')])).toEqual([
      'higher-902',
    ]);
    expect(samey(thrice.slice(0, 2))).toEqual([]);
  });

  test('options out of order, on the wrong side, unmirrored, or at the wrong level', () => {
    expect(misshapen([made('fine', '£2.00', ['Higher, £5.00', 'Lower, 80p'])])).toEqual([]);
    expect(misshapen([made('order', '£2.00', ['Lower, 80p', 'Higher, £5.00'])])).toEqual(['order']);
    expect(misshapen([made('side', '£2.00', ['Higher, £1.50', 'Lower, 80p'])])).toEqual(['side']);
    expect(misshapen([made('nearer', '£2.00', ['Higher, £5.00', 'Lower, £1.50'])])).toEqual(['nearer']);
    expect(misshapen([made('level', '£2.00', ['Higher, £5.00', 'Lower, 80p'], 'hard')])).toEqual(['level']);
  });
});
