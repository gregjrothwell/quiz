import { describe, expect, test } from 'vitest';
import {
  blankedQuestion,
  normalisePhrase,
  overlapsWith,
  substitute,
  wholeWordIndices,
} from './blanks-core';
import { BLANK_SPECS, BLANKS_MIN_PACK, BLANKS_MIN_PER_LEVEL } from './hand-blanks-data';
import { CATCHPHRASE_SPECS } from './hand-catchphrase-data';
import { DIFFICULTIES } from '../src/questions/types';

/*
  Greg plays this round blind, so nothing in this file names a phrase from the
  pack, and every assertion over the data reports slugs (numbers) rather than
  phrases. The fixtures below are invented and deliberately not in the pack.
*/

describe('wholeWordIndices', () => {
  test('finds a word only where it stands alone', () => {
    // #given a word that also appears inside a longer word
    // #then only the standalone occurrence counts
    expect(wholeWordIndices('the cat sat on the catalogue', 'cat')).toEqual([4]);
  });

  test('treats an apostrophe at the end of a word as part of it', () => {
    // #given an answer that is a dropped-g word
    // #then it is found, and not inside the longer word it begins
    expect(wholeWordIndices("I'm singin' it, singing it", "singin'")).toEqual([4]);
  });

  test('is case-insensitive', () => {
    expect(wholeWordIndices('Plums are plums', 'plums')).toEqual([0, 10]);
  });
});

describe('blankedQuestion', () => {
  test('a saying is the phrase with its first letter raised and the word blanked', () => {
    expect(blankedQuestion({ phrase: 'a penny saved is a penny earned', answer: 'earned' })).toBe(
      'A penny saved is a penny _____',
    );
  });

  test('a clue goes in front, and the phrase goes in quotes', () => {
    expect(
      blankedQuestion({ phrase: 'Wibble on, wobble off', answer: 'wobble', clue: 'Mr Blobby', kind: 'catchphrase' }),
    ).toBe('Mr Blobby: “Wibble on, _____ off”');
  });

  test('a slogan with no clue is quoted as it stands', () => {
    expect(blankedQuestion({ phrase: 'Wibble on, wobble off', answer: 'wobble', kind: 'slogan' })).toBe(
      '“Wibble on, _____ off”',
    );
  });

  test('refuses an answer that is not in the phrase exactly once', () => {
    expect(() => blankedQuestion({ phrase: 'a penny saved is a penny earned', answer: 'penny' })).toThrow();
    expect(() => blankedQuestion({ phrase: 'a penny saved is a penny earned', answer: 'pound' })).toThrow();
  });
});

describe('substitute', () => {
  test('puts a distractor where the answer was, keeping the rest exact', () => {
    expect(substitute('a penny saved is a penny earned', 'earned', 'spent')).toBe(
      'a penny saved is a penny spent',
    );
  });
});

describe('normalisePhrase', () => {
  test('folds case, curly quotes and punctuation so a source can be searched', () => {
    expect(normalisePhrase('Wibble ON — “wobble” off!')).toBe('wibble on wobble off');
    expect(normalisePhrase('I’m singin’ it')).toBe("i'm singin' it");
  });
});

describe('overlapsWith', () => {
  test('a phrase that contains another of two words or more overlaps it', () => {
    expect(overlapsWith('a penny saved is a penny earned', 'penny saved')).toBe(true);
    expect(overlapsWith('penny saved', 'a penny saved is a penny earned')).toBe(true);
  });

  test('a single shared word does not count, or every phrase with "the" would', () => {
    expect(overlapsWith('a penny saved is a penny earned', 'penny')).toBe(false);
  });

  test('a match must be whole words', () => {
    expect(overlapsWith('the catalogue is late', 'cat a')).toBe(false);
  });
});

describe('the Blankety Blank specs', () => {
  test(`at least ${BLANKS_MIN_PACK} questions, and ${BLANKS_MIN_PER_LEVEL} at every level`, () => {
    // AC1: every level fills a default round
    expect(BLANK_SPECS.length).toBeGreaterThanOrEqual(BLANKS_MIN_PACK);
    for (const level of DIFFICULTIES) {
      const count = BLANK_SPECS.filter((spec) => spec.difficulty === level).length;
      expect({ level, count, enough: count >= BLANKS_MIN_PER_LEVEL }).toEqual({
        level,
        count,
        enough: true,
      });
    }
  });

  test('every slug is blank- and a number, never the phrase', () => {
    // AC7 and the blind rule: a slug in a test failure must not spoil anything
    const bad = BLANK_SPECS.filter((spec) => !/^blank-\d{3}$/.test(spec.slug)).map((spec) => spec.slug);
    expect(bad).toEqual([]);
  });

  test('every answer is in its phrase exactly once, as a whole word', () => {
    // AC2
    const bad = BLANK_SPECS.filter((spec) => wholeWordIndices(spec.phrase, spec.answer).length !== 1).map(
      (spec) => spec.slug,
    );
    expect(bad).toEqual([]);
  });

  test('three distractors, four distinct options, none of them the answer in another case', () => {
    const bad = BLANK_SPECS.filter((spec) => {
      const options = [spec.answer, ...spec.incorrect].map((option) => option.toLowerCase());
      return spec.incorrect.length !== 3 || new Set(options).size !== 4;
    }).map((spec) => spec.slug);
    expect(bad).toEqual([]);
  });

  test('no clue gives its answer away', () => {
    const bad = BLANK_SPECS.filter(
      (spec) => spec.clue !== undefined && wholeWordIndices(spec.clue, spec.answer).length > 0,
    ).map((spec) => spec.slug);
    expect(bad).toEqual([]);
  });

  test('a saying is its own Wiktionary title; slogans and catchphrases cite Wikipedia', () => {
    // AC3's offline half: the live check fetches exactly what the spec names
    const bad = BLANK_SPECS.filter((spec) =>
      spec.kind === 'saying'
        ? spec.source.site !== 'wiktionary' || spec.source.title !== spec.phrase
        : spec.source.site !== 'wikipedia',
    ).map((spec) => spec.slug);
    expect(bad).toEqual([]);
  });

  test('no phrase overlaps a Catchphrase answer, either way round', () => {
    /*
      AC6. Greg plays Catchphrase blind, so a Blankety Blank question that
      contains one of its answers would give the puzzle away, and the reverse.
      The failure names Blankety Blank slugs only — numbers — never a phrase
      from either pack.
    */
    const answers = CATCHPHRASE_SPECS.map((spec) => spec.correct);
    const clashing = BLANK_SPECS.filter((spec) =>
      answers.some((answer) => overlapsWith(spec.phrase, answer)),
    ).map((spec) => spec.slug);
    expect(clashing).toEqual([]);
  });

  test('the question the room sees can be built for every spec', () => {
    const bad = BLANK_SPECS.filter((spec) => {
      try {
        return !blankedQuestion(spec).includes('_____');
      } catch {
        // A throw is the finding: `blankedQuestion` refuses an ambiguous blank.
        return true;
      }
    }).map((spec) => spec.slug);
    expect(bad).toEqual([]);
  });
});
