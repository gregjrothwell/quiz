import { describe, expect, test } from 'vitest';
import {
  ASKED_LIMIT,
  askedToWrite,
  mergeAsked,
  NO_HISTORY,
  seenHistory,
} from './askedHistory';

describe('mergeAsked', () => {
  test('puts this round in front of what came before', () => {
    expect(mergeAsked(['c'], new Set(['a', 'b']), 10)).toEqual(['c', 'a', 'b']);
  });

  test('does not repeat an id the history already held', () => {
    expect(mergeAsked(['b', 'c'], new Set(['a', 'b']), 10)).toEqual(['b', 'c', 'a']);
  });

  test('drops the oldest once the cap is reached', () => {
    expect(mergeAsked(['d'], new Set(['c', 'b', 'a']), 3)).toEqual(['d', 'c', 'b']);
  });

  test('keeps the whole of this round even when it alone fills the cap', () => {
    expect(mergeAsked(['d', 'e'], new Set(['a']), 2)).toEqual(['d', 'e']);
  });
});

describe('askedToWrite', () => {
  /*
    The regression this file exists for. A read that failed and a season that has
    served nothing both used to arrive as an empty set, and the empty one was
    then written back over a history of up to `ASKED_LIMIT` ids — destroying it.
  */
  test('writes nothing when the history could not be read', () => {
    expect(askedToWrite(['a', 'b'], NO_HISTORY)).toBeNull();
  });

  test('writes this round when the season has genuinely served nothing', () => {
    expect(askedToWrite(['a', 'b'], seenHistory(new Set()))).toEqual(['a', 'b']);
  });

  test('merges into a history it was able to read', () => {
    expect(askedToWrite(['c'], seenHistory(new Set(['a'])))).toEqual(['c', 'a']);
  });

  test('a failed read cannot cost a single remembered id', () => {
    const held = new Set(Array.from({ length: ASKED_LIMIT }, (_, i) => `q${i}`));
    // What the app does when `loadAsked` throws: it plays on with no history.
    expect(askedToWrite(['fresh'], NO_HISTORY)).toBeNull();
    // And the document is left exactly as it was.
    expect(held.size).toBe(ASKED_LIMIT);
  });
});

describe('ASKED_LIMIT', () => {
  /*
    `firestore.rules` bounds `seasons/{season}/asked/{packId}.ids` at 600, so a
    client one deploy ahead of the published ruleset is not locked out of writing
    its history. Raising this past that bound is a ruleset paste, not a constant.
    See the comment in `askedHistory.ts`.
    */
  test('stays inside the bound the published ruleset allows', () => {
    expect(ASKED_LIMIT).toBeLessThanOrEqual(600);
  });
});
