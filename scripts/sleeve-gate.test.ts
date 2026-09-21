import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';
import { SLEEVE_SPECS } from './hand-sleeves-data';
import { SLEEVE_COVER_TEXT } from './sleeve-cover-text';
import { sleeveVerdict } from './title-on-cover';
import { stableId } from './write-hand-packs';

/**
 * That what was published is what the gate allowed.
 *
 * `title-on-cover.test.ts` checks the rule; this checks it was *applied*. The
 * failure it exists for is the one the pack already had — a build that ran
 * green while publishing 33 questions with the answer printed on the picture.
 * A rule nothing enforces is a preference.
 *
 * Offline and static, like `seal.test.ts`: it compares the file in the repo
 * against the audited cover text in the repo, with no network and no Mac.
 */

const PACK = resolve(import.meta.dirname, '../public/packs/sleeves.json');

interface Published {
  id: string;
  options: string[];
  difficulty: string;
}

const published = (
  JSON.parse(readFileSync(PACK, 'utf8')) as { questions: Published[] }
).questions;

const bySlug = new Map(SLEEVE_SPECS.map((spec) => [stableId(spec.slug), spec]));

describe('the sleeves gate', () => {
  // Guards the guard: an empty pack would pass every assertion below.
  test('there are sleeves to check', () => {
    expect(published.length).toBeGreaterThanOrEqual(36);
    expect(SLEEVE_SPECS.length).toBeGreaterThan(published.length);
  });

  test('no published sleeve has the answer written on its cover', () => {
    const talking = published.filter((question) => {
      const spec = bySlug.get(question.id);
      if (!spec) return true;
      const cover = SLEEVE_COVER_TEXT[spec.slug];
      if (cover === undefined) return true;
      return !sleeveVerdict(spec.correct, spec.artist, cover).publishable;
    });
    expect(talking.map((question) => question.id)).toEqual([]);
  });

  test('every sleeve the gate refused is absent from the pack', () => {
    const ids = new Set(published.map((question) => question.id));
    const leaked = SLEEVE_SPECS.filter((spec) => {
      const cover = SLEEVE_COVER_TEXT[spec.slug];
      const refused = cover === undefined || !sleeveVerdict(spec.correct, spec.artist, cover).publishable;
      return refused && ids.has(stableId(spec.slug));
    });
    expect(leaked.map((spec) => spec.slug)).toEqual([]);
  });

  test('the covers that broke round 53FN are all gone', () => {
    /*
      The eleven sleeves in the round played on 21 September 2026 whose cover
      named the album, by the slug that produced them. Named rather than
      counted, because "the gate refuses some things" is not the claim — the
      claim is that it refuses *these*, which is what the office saw.
    */
    const broke = [
      'the-wall',
      'london-calling',
      'nevermind',
      '21-adele',
      'automatic-for-the-people',
      'different-class',
      'channel-orange',
      'illmatic',
      'dummy',
      'the-bends',
      'sgt-pepper',
    ];
    const ids = new Set(published.map((question) => question.id));
    const survivors = broke.filter((slug) => ids.has(stableId(slug)));
    expect(survivors).toEqual([]);
  });

  test('every published sleeve offers four distinct options', () => {
    for (const question of published) {
      expect(question.options).toHaveLength(4);
      expect(new Set(question.options).size).toBe(4);
    }
  });

  test('an unaudited cover is refused rather than trusted', () => {
    // #given a spec the audit has never seen — the state every spec is in the
    // moment somebody adds one
    const unaudited = SLEEVE_SPECS.filter((spec) => SLEEVE_COVER_TEXT[spec.slug] === undefined);
    const ids = new Set(published.map((question) => question.id));

    // #then none of them shipped. An unaudited cover is precisely the one
    // nobody has looked at, so it is the last one to give the benefit of the
    // doubt to.
    expect(unaudited.filter((spec) => ids.has(stableId(spec.slug))).map((s) => s.slug)).toEqual([]);
  });

  test('the audit covers what it claims to', () => {
    // A cover-text file that had gone stale — keys for slugs that no longer
    // exist — would silently gate nothing while looking complete.
    const slugs = new Set(SLEEVE_SPECS.map((spec) => spec.slug));
    const orphans = Object.keys(SLEEVE_COVER_TEXT).filter((slug) => !slugs.has(slug));
    expect(orphans).toEqual([]);
  });
});

