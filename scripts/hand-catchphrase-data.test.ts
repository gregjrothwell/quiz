import { createHash } from 'node:crypto';
import { describe, expect, test } from 'vitest';
import {
  CATCHPHRASE_MIN_PACK,
  CATCHPHRASE_SPECS,
  CATCHPHRASE_STYLE,
  MR_FRIES,
  friesSceneOk,
  friesShareOk,
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

/*
  Mr Fries, the house character — Greg chose him on 5 October 2026 and approved
  the story the same day: docs/decisions/mr-fries.md. He goes into new pictures
  only; the 30 that shipped are not to be redrawn.
*/
describe('Mr Fries', () => {
  const shipped = CATCHPHRASE_SPECS.slice(0, CATCHPHRASE_MIN_PACK);

  const spec = (overrides: Partial<CatchphraseSpec>): CatchphraseSpec => ({
    slug: 'fixture',
    correct: 'A saying nobody uses',
    incorrect: ['One', 'Two', 'Three'],
    difficulty: 'medium',
    scene: 'The character is standing on a hill.',
    ...overrides,
  });

  test('the 30 shipped prompts are exactly as drawn', () => {
    // A hash, so this file can pin them without anybody reading them. New
    // puzzles go on the end of the list; changing the style, him, or
    // `promptFor` in a way that reaches these breaks it.
    const hash = createHash('sha256').update(shipped.map(promptFor).join('\n')).digest('hex');
    expect(hash).toBe('0cedeae870ca02014db97c40923ba8b94bf4fcd15875653142bc1406761f4749');
  });

  test('is the bean Greg chose', () => {
    expect(MR_FRIES).toBe(
      'A cartoon character whose whole body is a single smooth rounded golden-yellow potato chip shaped like a bean, flat colour with no crumbs or speckles. It has two big round white eyes with black pupils, a wide happy smile, thin black stick arms with white cartoon gloves, and thin black stick legs with red trainers.',
    );
  });

  test('comes after the house style and before the scene, only when asked for', () => {
    expect(promptFor(spec({ fries: true }))).toBe(
      `${CATCHPHRASE_STYLE} ${MR_FRIES} The character is standing on a hill. No writing anywhere in the image.`,
    );
    expect(promptFor(spec({ scene: 'A hill.' }))).toBe(
      `${CATCHPHRASE_STYLE} A hill. No writing anywhere in the image.`,
    );
  });

  test('his name is never in a prompt — a name invites lettering', () => {
    expect(MR_FRIES).not.toMatch(/fries/i);
    for (const each of [...CATCHPHRASE_SPECS, spec({ fries: true })]) {
      expect(promptFor(each)).not.toMatch(/mr\.?\s*fries/i);
    }
  });

  test('every scene with him calls him the character', () => {
    expect(CATCHPHRASE_SPECS.filter((each) => !friesSceneOk(each)).map((each) => each.slug)).toEqual([]);
  });

  test('the check refuses a scene that never says who he is', () => {
    expect(friesSceneOk(spec({ fries: true, scene: 'A potato is standing on a hill.' }))).toBe(false);
    expect(friesSceneOk(spec({ fries: true }))).toBe(true);
    expect(friesSceneOk(spec({ scene: 'A hill.' }))).toBe(true);
  });

  test('he is in more than half of everything added after the 30', () => {
    expect(friesShareOk(CATCHPHRASE_SPECS, CATCHPHRASE_MIN_PACK)).toBe(true);
  });

  test('the share check counts only what was added, and half is not most', () => {
    const plain = spec({ scene: 'A hill.' });
    const him = spec({ fries: true });
    expect(friesShareOk([...shipped], CATCHPHRASE_MIN_PACK)).toBe(true);
    expect(friesShareOk([...shipped, him, plain], CATCHPHRASE_MIN_PACK)).toBe(false);
    expect(friesShareOk([...shipped, him, him, plain], CATCHPHRASE_MIN_PACK)).toBe(true);
    expect(friesShareOk([...shipped, plain], CATCHPHRASE_MIN_PACK)).toBe(false);
  });
});
