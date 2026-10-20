import { describe, expect, test } from 'vitest';
import { shelvePacks, SHOW_ROUNDS } from './shelves';
import type { PackId, PackSummary } from './types';

function pack(id: PackId): PackSummary {
  return { id, title: id, blurb: '', count: 10, counts: { easy: 3, medium: 4, hard: 3 } };
}

describe('shelvePacks', () => {
  test('puts the show rounds first, most played first, whatever order the index is in', () => {
    const index = (['general-knowledge', 'melody', 'sport', 'tunes', 'screens', 'random'] as const).map(pack);
    const [show, trivia] = shelvePacks(index);
    expect(show?.id).toBe('show');
    expect(show?.packs.map((p) => p.id)).toEqual(['random', 'screens', 'tunes', 'melody']);
    expect(trivia?.id).toBe('trivia');
    expect(trivia?.packs.map((p) => p.id)).toEqual(['general-knowledge', 'sport']);
  });

  test('every pack appears exactly once', () => {
    const index = ([...SHOW_ROUNDS, 'history', 'science', 'uk-leaning'] as PackId[]).map(pack);
    const shelved = shelvePacks(index).flatMap((shelf) => shelf.packs.map((p) => p.id));
    expect(shelved).toHaveLength(index.length);
    expect(new Set(shelved)).toEqual(new Set(index.map((p) => p.id)));
  });

  test('a pack on neither list is trivia, and an empty shelf is left out', () => {
    expect(shelvePacks([pack('history')]).map((shelf) => shelf.id)).toEqual(['trivia']);
    expect(shelvePacks([pack('screens')]).map((shelf) => shelf.id)).toEqual(['show']);
    expect(shelvePacks([])).toEqual([]);
  });
});
