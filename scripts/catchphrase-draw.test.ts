import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { drawArgs, drawingPath } from './catchphrase-draw';
import { promptFor, type CatchphraseSpec } from './hand-catchphrase-data';

describe('drawing a catchphrase', () => {
  const spec: CatchphraseSpec = {
    slug: 'cp-probe',
    correct: 'A probe',
    incorrect: ['One', 'Two', 'Three'],
    difficulty: 'easy',
    scene: 'A scene.',
  };
  const args = drawArgs(spec, '/models/z', '/out');

  test('asks mflux to leave the prompt out of the file', () => {
    // The prompt describes the answer; without this flag mflux embeds it.
    expect(args).toContain('--no-metadata');
  });

  test('sends the spec’s own prompt, from the saved 8-bit copy, three versions', () => {
    expect(args[args.indexOf('--prompt') + 1]).toBe(promptFor(spec));
    expect(args[args.indexOf('--model') + 1]).toBe('/models/z');
    expect(args.slice(args.indexOf('--seed') + 1, args.indexOf('--seed') + 4)).toEqual(['1', '2', '3']);
    expect(args).not.toContain('-q');
    expect(args).not.toContain('--quantize');
  });

  test('names each version the way mflux writes it', () => {
    expect(args[args.indexOf('--output') + 1]).toBe(join('/out', `${spec.slug}.png`));
    expect(drawingPath(spec.slug, 2, '/out')).toBe(join('/out', `${spec.slug}_seed_2.png`));
  });
});
