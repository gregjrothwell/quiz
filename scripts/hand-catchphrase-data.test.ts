import { describe, expect, test } from 'vitest';
import {
  CATCHPHRASE_MIN_PACK,
  CATCHPHRASE_SPECS,
  CATCHPHRASE_STYLE,
  namesTheAnswer,
  promptFor,
  type CatchphraseSpec,
} from './hand-catchphrase-data';

/*
  The rules here came out of the trial on 2 October 2026 —
  docs/decisions/catchphrase.md. The one that matters most is the seal: the
  model letters whatever it is told, so a prompt that says the phrase is a
  picture that can print the answer. A prompt that never says it is the
  structural reason a drawing cannot.
*/

describe('catchphrase puzzles', () => {
  test('thirty of them, eight easy, fourteen medium and eight hard', () => {
    expect(CATCHPHRASE_SPECS.length).toBeGreaterThanOrEqual(CATCHPHRASE_MIN_PACK);
    const count = (level: string) => CATCHPHRASE_SPECS.filter((spec) => spec.difficulty === level).length;
    expect([count('easy'), count('medium'), count('hard')]).toEqual([8, 14, 8]);
  });

  test('no prompt says the phrase it is drawing', () => {
    const naming = CATCHPHRASE_SPECS.filter((spec) => namesTheAnswer(promptFor(spec), spec.correct));
    expect(naming.map((spec) => spec.slug)).toEqual([]);
  });

  test('the writing a puzzle asks for is never the whole answer', () => {
    const lettered = CATCHPHRASE_SPECS.filter((spec) => spec.lettering !== undefined);
    expect(lettered.length).toBeGreaterThan(0);
    for (const spec of lettered) {
      expect(namesTheAnswer(spec.lettering ?? '', spec.correct)).toBe(false);
    }
  });

  test('every prompt leads with the house style and says what writing is allowed', () => {
    for (const spec of CATCHPHRASE_SPECS) {
      const prompt = promptFor(spec);
      expect(prompt.startsWith(CATCHPHRASE_STYLE)).toBe(true);
      expect(prompt).toMatch(
        spec.lettering === undefined
          ? /No writing anywhere in the image\.$/
          : new RegExp(`${spec.lettering} is the only writing in the image\\.$`),
      );
    }
  });

  test('no wrong answer is another wording of the right one', () => {
    for (const spec of CATCHPHRASE_SPECS) {
      for (const wrong of spec.incorrect) {
        expect(namesTheAnswer(wrong, spec.correct)).toBe(false);
        expect(namesTheAnswer(spec.correct, wrong)).toBe(false);
      }
    }
  });
});

describe('the check itself refuses a prompt that names its answer', () => {
  // The half that makes the passes above mean something: a matcher that never
  // matches would pass every test in the block before this one.
  const spec: CatchphraseSpec = {
    slug: 'cp-probe',
    correct: 'A storm in a teacup',
    incorrect: ['x', 'y', 'z'],
    difficulty: 'easy',
    scene: 'A storm in a teacup, drawn literally.',
  };

  test('the phrase in the scene is caught, article or not, any case', () => {
    expect(namesTheAnswer(promptFor(spec), spec.correct)).toBe(true);
    expect(namesTheAnswer('THE STORM IN A TEACUP!', spec.correct)).toBe(true);
  });

  test('punctuation does not hide it', () => {
    expect(namesTheAnswer('out of the frying-pan, into the fire', 'Out of the frying pan, into the fire')).toBe(true);
    expect(namesTheAnswer("dad's army", "Dad's Army")).toBe(true);
  });

  test('a shared word is not the answer', () => {
    expect(namesTheAnswer('a tiny storm cloud over a teacup', spec.correct)).toBe(false);
    expect(namesTheAnswer('the word ONLY above two horses', 'Only Fools and Horses')).toBe(false);
  });

  test('a word inside a longer word is not the answer', () => {
    expect(namesTheAnswer('topdogs', 'Top dog')).toBe(false);
  });
});
