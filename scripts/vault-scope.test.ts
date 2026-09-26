import { describe, expect, test } from 'vitest';
import { packArgs, scopeToPacks } from './vault-scope';

describe('packArgs', () => {
  test('reads comma lists and repeated flags alike', () => {
    // #given both spellings on one command line
    const argv = ['node', 'seed-vault.ts', '--pack', 'screens,sleeves', '--pack', 'flags'];

    // #when the packs are read
    const packs = packArgs(argv);

    // #then all three come back in order
    expect(packs).toEqual(['screens', 'sleeves', 'flags']);
  });

  test('names nothing when the flag is absent, so the full seed still runs', () => {
    // #given a bare invocation
    const argv = ['node', 'seed-vault.ts'];

    // #when the packs are read
    const packs = packArgs(argv);

    // #then there is no scope
    expect(packs).toEqual([]);
  });

  test('ignores blanks and repeats', () => {
    // #given a sloppy list
    const argv = ['--pack', 'screens,,screens', '--pack', ' '];

    // #when the packs are read
    const packs = packArgs(argv);

    // #then one pack, once
    expect(packs).toEqual(['screens']);
  });
});

describe('scopeToPacks', () => {
  const answers = { a1: 'Alpha', a2: 'Beta', b1: 'Gamma', hq0: 'The first one' };

  test('keeps only the answers for questions in the named packs', () => {
    // #given one pack of two questions out of a larger vault
    const packs = [{ id: 'screens', questions: [{ id: 'a1' }, { id: 'a2' }] }];

    // #when the seed is scoped
    const scoped = scopeToPacks(answers, packs);

    // #then only that pack's answers remain, so only they are read and written
    expect(scoped.answers).toEqual({ a1: 'Alpha', a2: 'Beta' });
    expect(scoped.missing).toEqual([]);
  });

  test('reports a question the cache has no answer for', () => {
    // #given a pack holding a question the harvest never answered
    const packs = [{ id: 'screens', questions: [{ id: 'a1' }, { id: 'zz' }] }];

    // #when the seed is scoped
    const scoped = scopeToPacks(answers, packs);

    // #then it is named rather than silently skipped — it would stall at reveal
    expect(scoped.missing).toEqual(['zz']);
    expect(scoped.answers).toEqual({ a1: 'Alpha' });
  });
});
