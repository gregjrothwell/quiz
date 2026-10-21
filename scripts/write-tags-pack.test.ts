import { describe, expect, test } from 'vitest';
import { MIN_SPACING } from './prices-core';
import { KIND_LABEL, TAG_SPECS, TAGS_MIN_PER_LEVEL, TAGS_MONTH, type TagKind, type TagSpec } from './hand-tags-data';
import { PRICE_SPECS, SPOILED_KEYS } from './hand-prices-data';
import { tagDrawingPath } from './tags-draw';
import {
  buildTagsPack,
  levelsFor,
  overlapsWithPriceWasRight,
  placesFor,
  priceFor,
  priceTags,
  stepForLadder,
  tagQuestion,
} from './write-tags-pack';
import type { Observed } from './write-prices-pack';
import { basename } from 'node:path';

/**
 * Invented prices only: Greg plays this round blind. A spread from 40p to
 * £2,500 so every rounding step is exercised.
 */
function invented(specs: readonly TagSpec[] = TAG_SPECS, n = 120): Observed {
  const quotes: Observed['quotes'][string] = {};
  specs.forEach((spec, i) => {
    quotes[spec.key] = { desc: spec.key, median: Number((0.4 * 1.11 ** i).toFixed(2)), n };
  });
  return { quotes: { [TAGS_MONTH]: quotes }, rpi: {} };
}

/** A pound figure back to pence, for spacing checks: `£1,250`, `£12.50`, `85p`. */
function pence(option: string): number {
  if (option.endsWith('p')) return Number(option.slice(0, -1));
  return Math.round(Number(option.slice(1).replace(/,/g, '')) * 100);
}

describe('the specs', () => {
  test('slugs and keys are unique', () => {
    expect(new Set(TAG_SPECS.map((spec) => spec.slug)).size).toBe(TAG_SPECS.length);
    expect(new Set(TAG_SPECS.map((spec) => spec.key)).size).toBe(TAG_SPECS.length);
  });

  test('nothing The Price Was Right asks, spoiled, or twins — its question prints this answer', () => {
    expect(overlapsWithPriceWasRight(TAG_SPECS)).toEqual([]);
  });

  test('the overlap rule refuses an asked key, a spoiled key, and a twin of either', () => {
    const asked = PRICE_SPECS[0]?.key ?? '';
    const spoiled = SPOILED_KEYS[0] ?? '';
    // 310110 is the premium-lager twin of a spoiled standard pint (TWIN_KEYS).
    const specs: TagSpec[] = [asked, spoiled, '310110', '999999'].map((key, i) => ({
      slug: `t-${i}`,
      key,
      name: 'a thing',
      kind: 'home',
      picture: 'a thing',
    }));
    expect(overlapsWithPriceWasRight(specs)).toEqual(['t-0', 't-1', 't-2']);
  });

  test('at least six kinds, none more than a quarter', () => {
    const counts = new Map<TagKind, number>();
    for (const spec of TAG_SPECS) counts.set(spec.kind, (counts.get(spec.kind) ?? 0) + 1);
    expect(counts.size).toBeGreaterThanOrEqual(6);
    for (const [kind, n] of counts) {
      expect(n, kind).toBeLessThanOrEqual(TAG_SPECS.length / 4);
      expect(KIND_LABEL[kind]).toBeTruthy();
    }
  });
});

describe('priceFor', () => {
  test('refuses an item not quoted that month, or quoted in fewer than 30 shops', () => {
    const spec = TAG_SPECS[0] as TagSpec;
    expect(() => priceFor(spec, { quotes: {}, rpi: {} })).toThrow('not quoted');
    expect(() => priceFor(spec, invented([spec], 29))).toThrow('fewer than 30');
    expect(priceFor(spec, invented([spec], 30))).toBe(40);
  });
});

describe('levels and places', () => {
  test('levels dealt easy, medium, hard in turn', () => {
    const levels = [...levelsFor(TAG_SPECS).values()];
    expect(levels.slice(0, 6)).toEqual(['easy', 'medium', 'hard', 'easy', 'medium', 'hard']);
  });

  test('every four specs use each place once', () => {
    const places = TAG_SPECS.map((spec) => placesFor(TAG_SPECS).get(spec.slug));
    for (let start = 0; start + 4 <= places.length; start += 4) {
      expect([...places.slice(start, start + 4)].sort()).toEqual([0, 1, 2, 3]);
    }
  });

  test('neighbouring blocks are not all in the same order', () => {
    const places = TAG_SPECS.map((spec) => placesFor(TAG_SPECS).get(spec.slug));
    const blocks = new Set<string>();
    for (let start = 0; start + 4 <= places.length; start += 4) blocks.add(places.slice(start, start + 4).join(''));
    expect(blocks.size).toBeGreaterThan(5);
  });

  test('appending specs moves no earlier answer, and a drop moves no other', () => {
    const half = TAG_SPECS.slice(0, 40);
    const tagsHalf = priceTags(invented(), half);
    const tagsAll = priceTags(invented(), TAG_SPECS);
    expect(tagsAll.slice(0, 40).map((t) => t.answer)).toEqual(tagsHalf.map((t) => t.answer));

    const dropped = TAG_SPECS.map((spec, i) => (i === 5 ? { ...spec, dropped: 'test' } : spec));
    const after = priceTags(invented(), dropped);
    const before = tagsAll.filter((t) => t.spec.slug !== TAG_SPECS[5]?.slug);
    expect(after.map((t) => [t.spec.slug, t.answer, t.options])).toEqual(
      before.map((t) => [t.spec.slug, t.answer, t.options]),
    );
  });
});

describe('the options', () => {
  const tags = priceTags(invented());

  test('four, low to high, at least 12% apart, the answer among them', () => {
    for (const { spec, options, answer } of tags) {
      expect(options, spec.slug).toHaveLength(4);
      expect(options).toContain(answer);
      const values = options.map(pence);
      for (let i = 1; i < 4; i += 1) {
        expect((values[i] as number) / (values[i - 1] as number), spec.slug).toBeGreaterThanOrEqual(MIN_SPACING - 1e-9);
      }
    }
  });

  test('the answer is in each place equally often', () => {
    const counts = [0, 0, 0, 0];
    for (const { options, answer } of tags) {
      const at = options.indexOf(answer);
      counts[at] = (counts[at] ?? 0) + 1;
    }
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
  });

  test('at least 15 at each level', () => {
    for (const level of ['easy', 'medium', 'hard'] as const) {
      expect(tags.filter((t) => t.difficulty === level).length).toBeGreaterThanOrEqual(TAGS_MIN_PER_LEVEL);
    }
  });

  test('all four share one rounding, whatever place the answer is in', () => {
    for (const { options } of tags) {
      const pennies = options.map((option) => option.endsWith('p') || /\.\d\d$/.test(option));
      const pounds = options.filter((option) => option.startsWith('£') && !option.includes('.'));
      // Either every option shows pence, or none does.
      expect(pounds.length === 0 || pennies.every((shows) => !shows)).toBe(true);
    }
  });

  test('the step comes from the ladder shown, not from where the answer sits in it', () => {
    // The same visible middle gives the same step whichever place the answer is in.
    // £11 sits just over the 10p/50p boundary, where the answer's own price
    // would round two places one way and two the other.
    const middle = 1_100;
    const ratio = 1.3;
    const steps = [0, 1, 2, 3].map((position) => stepForLadder(middle / ratio ** (1.5 - position), ratio, position));
    expect(new Set(steps).size).toBe(1);
  });
});

describe('buildTagsPack', () => {
  const picked = TAG_SPECS.map((spec) => ({ ...spec, seed: 1 }));
  const clean = Object.fromEntries(picked.map((spec) => [basename(tagDrawingPath(spec.slug, 1)), [] as string[]]));
  const deps = {
    specs: picked,
    text: clean,
    readDrawing: async () => Buffer.from('png'),
    store: async (png: Buffer) => `stills/${png.length}.jpg`,
  };

  test('a sealed pack: options, image and no answer field', async () => {
    const { pack, answers } = await buildTagsPack(invented(), deps);
    expect(pack.id).toBe('tags');
    expect(pack.questions).toHaveLength(TAG_SPECS.length);
    for (const question of pack.questions) {
      expect(Object.keys(question)).not.toContain('correct');
      expect(question.image).toBeTruthy();
      expect(question.ordered).toBe(true);
      expect(question.options).toContain(answers[question.id]);
    }
    expect(pack.questions[0]?.question).toBe(tagQuestion(TAG_SPECS[0] as TagSpec));
  });

  test('refuses a spec nobody picked, an unread drawing, and any writing', async () => {
    const first = picked[0] as TagSpec;
    const unpickedFirst: TagSpec = { slug: first.slug, key: first.key, name: first.name, kind: first.kind, picture: first.picture };
    const unpicked = picked.map((spec, i) => (i === 0 ? unpickedFirst : spec));
    await expect(buildTagsPack(invented(), { ...deps, specs: unpicked })).rejects.toThrow('no drawing picked');

    const unread = { ...clean };
    delete unread[basename(tagDrawingPath(picked[1]?.slug ?? '', 1))];
    await expect(buildTagsPack(invented(), { ...deps, text: unread })).rejects.toThrow('Vision never read');

    const written = { ...clean, [basename(tagDrawingPath(picked[2]?.slug ?? '', 1))]: ['£9.99'] };
    await expect(buildTagsPack(invented(), { ...deps, text: written })).rejects.toThrow('carries writing');
  });

  test('a dropped spec ships nothing and refuses nothing', async () => {
    const withDrop = picked.map((spec, i) => (i === 0 ? { ...(TAG_SPECS[0] as TagSpec), dropped: 'test' } : spec));
    const { pack } = await buildTagsPack(invented(), { ...deps, specs: withDrop });
    expect(pack.questions).toHaveLength(TAG_SPECS.length - 1);
  });
});
