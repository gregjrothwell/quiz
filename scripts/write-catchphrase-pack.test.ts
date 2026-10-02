import { describe, expect, test } from 'vitest';
import type { CatchphraseSpec } from './hand-catchphrase-data';
import { buildCatchphrasePack } from './write-catchphrase-pack';
import { stableId } from './write-hand-packs';

/** Thirty picked puzzles, enough to clear the minimum, with a drawing each. */
function picked(count = 30): CatchphraseSpec[] {
  return Array.from({ length: count }, (_, i) => ({
    slug: `cp-test-${i}`,
    correct: `Phrase number ${i}`,
    incorrect: [`Wrong ${i}a`, `Wrong ${i}b`, `Wrong ${i}c`],
    difficulty: 'medium',
    scene: `Scene ${i}`,
    seed: 2,
  }));
}

function readEverything(specs: CatchphraseSpec[]): Record<string, string[]> {
  return Object.fromEntries(specs.map((spec) => [`${spec.slug}_seed_${spec.seed ?? 0}.png`, []]));
}

const deps = (specs: CatchphraseSpec[], text = readEverything(specs)) => ({
  specs,
  text,
  readDrawing: async () => Buffer.from('png'),
  store: async () => `${'f'.repeat(64)}.jpg`,
});

describe('writing the Catchphrase pack', () => {
  test('seals every picked puzzle under the one prompt, answers kept apart', async () => {
    const specs = picked();
    const { pack, answers } = await buildCatchphrasePack(deps(specs));

    expect(pack.id).toBe('catchphrase');
    expect(pack.questions).toHaveLength(30);
    // The seal itself is `seal.test.ts`'s job once the pack is on disk; here,
    // only that the build hands it nothing answer-shaped.
    expect(JSON.stringify(pack)).not.toMatch(/"(correct|incorrect|answer|solution)/i);
    const first = pack.questions[0];
    expect(first?.question).toBe('Say what you see');
    expect(first?.category).toBe('Catchphrase');
    expect(first?.options).toHaveLength(4);
    expect(first?.jigsaw).toBeUndefined();
    expect(answers[stableId('cp-test-0')]).toBe('Phrase number 0');
  });

  test('ships the version that was picked, not another', async () => {
    const specs = picked();
    const read: string[] = [];
    await buildCatchphrasePack({
      ...deps(specs),
      readDrawing: async (path: string) => {
        read.push(path);
        return Buffer.from('png');
      },
    });
    expect(read.every((path) => path.endsWith('_seed_2.png'))).toBe(true);
  });

  test('refuses a puzzle nobody has picked a drawing for', async () => {
    const specs = picked();
    const unpicked = specs.map((spec, i) => {
      if (i !== 3) return spec;
      const copy = { ...spec };
      delete copy.seed;
      return copy;
    });
    await expect(buildCatchphrasePack(deps(unpicked))).rejects.toThrow(/cp-test-3: no drawing picked/);
  });

  test('refuses a drawing Vision never read', async () => {
    const specs = picked();
    const text = readEverything(specs);
    delete text['cp-test-5_seed_2.png'];
    await expect(buildCatchphrasePack(deps(specs, text))).rejects.toThrow(/cp-test-5: Vision never read/);
  });

  test('refuses a drawing that prints its own answer', async () => {
    const specs = picked();
    const text = { ...readEverything(specs), 'cp-test-7_seed_2.png': ['PHRASE NUMBER 7'] };
    await expect(buildCatchphrasePack(deps(specs, text))).rejects.toThrow(/cp-test-7: the drawing prints its own answer/);
  });

  test('allows a drawing whose writing is only part of the puzzle', async () => {
    const specs = picked();
    const text = { ...readEverything(specs), 'cp-test-7_seed_2.png': ['NUMBER'] };
    const { shipped } = await buildCatchphrasePack(deps(specs, text));
    expect(shipped['cp-test-7']).toBe('NUMBER');
  });

  test('refuses a pack under the minimum', async () => {
    await expect(buildCatchphrasePack(deps(picked(29)))).rejects.toThrow(/Only 29 catchphrases/);
  });
});
