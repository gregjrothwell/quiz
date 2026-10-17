import { createHash } from 'node:crypto';
import { describe, expect, test } from 'vitest';
import { overlapsWith } from './blanks-core';
import { BLANK_SPECS } from './hand-blanks-data';
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

/** Where the harder batch (5 October 2026) ends and the third begins. */
const HARDER_END = CATCHPHRASE_MIN_PACK + 30;
/** Where the third batch (6 October 2026) ends and the fourth begins. */
const THIRD_END = HARDER_END + 30;
/** Where the fourth batch (9 October 2026) ends and the fifth begins. */
const FOURTH_END = THIRD_END + 30;
/** Where the fifth batch (9 October 2026) ends and the sixth begins. */
const FIFTH_END = FOURTH_END + 60;
/** Where the sixth batch (17 October 2026) ends. Pins its prompts; `added` stays open until a seventh goes on. */
const SIXTH_END = FIFTH_END + 60;

/*
  The rules here came out of the trial on 2 October 2026 —
  docs/decisions/catchphrase.md. The one that matters most is the seal: the
  model letters whatever it is told, so a prompt that says the phrase is a
  picture that can print the answer. A prompt that never says it is the
  structural reason a drawing cannot.
*/

describe('catchphrase puzzles', () => {
  test('the first thirty: eight easy, fourteen medium and eight hard', () => {
    const first = CATCHPHRASE_SPECS.slice(0, CATCHPHRASE_MIN_PACK);
    expect(first).toHaveLength(CATCHPHRASE_MIN_PACK);
    const count = (level: string) => first.filter((spec) => spec.difficulty === level).length;
    expect([count('easy'), count('medium'), count('hard')]).toEqual([8, 14, 8]);
  });

  test('no two puzzles share an answer', () => {
    const clashes: string[] = [];
    CATCHPHRASE_SPECS.forEach((a, i) => {
      CATCHPHRASE_SPECS.slice(i + 1).forEach((b) => {
        if (namesTheAnswer(a.correct, b.correct) || namesTheAnswer(b.correct, a.correct)) {
          clashes.push(`${a.slug} / ${b.slug}`);
        }
      });
    });
    expect(clashes).toEqual([]);
  });

  test('no wrong answer is the right answer to another puzzle', () => {
    const clashes = CATCHPHRASE_SPECS.flatMap((spec) =>
      spec.incorrect.flatMap((wrong) =>
        CATCHPHRASE_SPECS.filter((other) => other !== spec && namesTheAnswer(wrong, other.correct)).map(
          (other) => `${spec.slug} offers ${other.slug}`,
        ),
      ),
    );
    expect(clashes).toEqual([]);
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

/*
  The harder batch — approved by Greg on 5 October 2026:
  docs/decisions/catchphrase-harder.md. Thirty more after the first thirty.
*/
describe('the harder batch', () => {
  const added = CATCHPHRASE_SPECS.slice(CATCHPHRASE_MIN_PACK, HARDER_END);

  test('is thirty puzzles', () => {
    expect(added).toHaveLength(30);
  });

  test('its 30 prompts are exactly as drawn', () => {
    // Pinned the way the first thirty are, once it had shipped: a later batch
    // goes on the end and never changes what a redraw of these would give.
    const hash = createHash('sha256').update(added.map(promptFor).join('\n')).digest('hex');
    expect(hash).toBe('21635e4eee9aac8199d18308c8ab9a899c800142e908cd3f4fc4cde19f493e8d');
  });

  test('is medium or hard, never easy — "hard" went 95% on 5 October', () => {
    expect(added.filter((spec) => spec.difficulty === 'easy').map((spec) => spec.slug)).toEqual([]);
  });

  test('says what kind each puzzle is, and no more than a third are one literal scene', () => {
    expect(added.filter((spec) => spec.kind === undefined).map((spec) => spec.slug)).toEqual([]);
    expect(added.filter((spec) => spec.kind === 'scene').length * 3).toBeLessThanOrEqual(added.length);
  });

  test('uses each of the harder kinds the show used', () => {
    for (const kind of ['rebus', 'lettered', 'soundalike'] as const) {
      expect(added.filter((spec) => spec.kind === kind).length).toBeGreaterThan(0);
    }
  });

  test('has not been drawn yet, or has a picked drawing — never half of one', () => {
    for (const spec of added) expect(spec.seed === undefined || [1, 2, 3].includes(spec.seed)).toBe(true);
  });
});

/*
  The third batch — Greg, 5 October 2026: "I feel like we need more
  catchphrases." The same rules as the harder batch, which is still unplayed:
  docs/decisions/catchphrase-batch-3.md. Thirty more after the first sixty.
*/
/**
 * Every option in `added` that the pack already uses, as an answer or a wrong
 * one, or that `added` uses twice. Case and punctuation do not hide a repeat.
 * Written for the third batch; the fourth holds itself to it too.
 */
function repeats(added: CatchphraseSpec[], before: CatchphraseSpec[]): string[] {
  const fold = (text: string) => text.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const seen = new Set(before.flatMap((spec) => [spec.correct, ...spec.incorrect]).map(fold));
  const found: string[] = [];
  for (const spec of added) {
    for (const option of [spec.correct, ...spec.incorrect]) {
      if (seen.has(fold(option))) found.push(`${spec.slug}: ${option}`);
      seen.add(fold(option));
    }
  }
  return found;
}

describe('the third batch', () => {
  const before = CATCHPHRASE_SPECS.slice(0, HARDER_END);
  const added = CATCHPHRASE_SPECS.slice(HARDER_END, THIRD_END);

  test('is thirty puzzles', () => {
    expect(added).toHaveLength(30);
  });

  test('its 30 prompts are exactly as drawn', () => {
    // Pinned once the fourth batch went on the end, as the second thirty were
    // when the third did: a later batch never changes what a redraw would give.
    const hash = createHash('sha256').update(added.map(promptFor).join('\n')).digest('hex');
    expect(hash).toBe('072aa4ce0031e52c73a16141670eefd2b7566d376c3e8cc1544ed411c3c4d03e');
  });

  test('is medium or hard, never easy', () => {
    expect(added.filter((spec) => spec.difficulty === 'easy').map((spec) => spec.slug)).toEqual([]);
  });

  test('says what kind each puzzle is, and no more than a third are one literal scene', () => {
    expect(added.filter((spec) => spec.kind === undefined).map((spec) => spec.slug)).toEqual([]);
    expect(added.filter((spec) => spec.kind === 'scene').length * 3).toBeLessThanOrEqual(added.length);
  });

  test('uses each of the harder kinds the show used', () => {
    for (const kind of ['rebus', 'lettered', 'soundalike'] as const) {
      expect(added.filter((spec) => spec.kind === kind).length).toBeGreaterThan(0);
    }
  });

  test('has Mr Fries in more than half of this batch on its own', () => {
    expect(friesShareOk(CATCHPHRASE_SPECS.slice(0, THIRD_END), HARDER_END)).toBe(true);
  });

  test('offers no option the pack already uses, as an answer or a wrong one', () => {
    // A wrong option seen before is a phrase the office has already ruled out,
    // so it stops doing its job. The first sixty repeat a few among themselves;
    // this batch does not add to that.
    expect(repeats(added, before)).toEqual([]);
  });

  test('the repeat check catches an option already in the pack, however it is written', () => {
    // The half that makes the pass above mean something: a check that never
    // matches would pass it too.
    const earlier = before[0];
    if (earlier === undefined) throw new Error('no earlier puzzles');
    const wrong = earlier.incorrect[0] ?? '';
    const fixture = (incorrect: string[]): CatchphraseSpec => ({
      slug: 'fixture',
      correct: 'A saying nobody uses',
      incorrect,
      difficulty: 'medium',
      scene: 'A hill.',
    });
    expect(repeats([fixture([`${wrong.toUpperCase()}!`, 'Two', 'Three'])], before)).toHaveLength(1);
    expect(repeats([fixture(['One', 'Two', earlier.correct])], before)).toHaveLength(1);
    expect(repeats([fixture(['One', 'Two', 'Three']), fixture(['Four', 'Five', 'One'])], before)).toHaveLength(2);
    expect(repeats([fixture(['One', 'Two', 'Three'])], before)).toEqual([]);
  });

  test('has not been drawn yet, or has a picked drawing — never half of one', () => {
    for (const spec of added) expect(spec.seed === undefined || [1, 2, 3].includes(spec.seed)).toBe(true);
  });
});

/*
  The fourth batch — 9 October 2026. Greg, after the 6 October office round
  went 78%: "a step in the right direction for difficulty — can probably push a
  bit higher". The third batch's rules, leaning harder:
  docs/decisions/catchphrase-batch-4.md. Thirty more after the first ninety.
*/
describe('the fourth batch', () => {
  const before = CATCHPHRASE_SPECS.slice(0, THIRD_END);
  const added = CATCHPHRASE_SPECS.slice(THIRD_END, FOURTH_END);
  const third = CATCHPHRASE_SPECS.slice(HARDER_END, THIRD_END);
  const hard = (specs: CatchphraseSpec[]) => specs.filter((spec) => spec.difficulty === 'hard').length;

  test('is thirty puzzles', () => {
    expect(added).toHaveLength(30);
  });

  test('its 30 prompts are exactly as drawn', () => {
    // Pinned once picked and shipped, 12 October 2026, as the third was. A
    // dropped puzzle is pinned too: it stays in the list as drawn.
    const hash = createHash('sha256').update(added.map(promptFor).join('\n')).digest('hex');
    expect(hash).toBe('aa102656356218a58615698729b6138dbb051f43a67c6240e07bd15e5be441e2');
  });

  test('is medium or hard, never easy', () => {
    expect(added.filter((spec) => spec.difficulty === 'easy').map((spec) => spec.slug)).toEqual([]);
  });

  test('leans harder than the third: mostly hard, and more hard than the third had', () => {
    expect(hard(added) * 2).toBeGreaterThan(added.length);
    expect(hard(added)).toBeGreaterThan(hard(third));
  });

  test('says what kind each puzzle is, and no more than a third are one literal scene', () => {
    expect(added.filter((spec) => spec.kind === undefined).map((spec) => spec.slug)).toEqual([]);
    expect(added.filter((spec) => spec.kind === 'scene').length * 3).toBeLessThanOrEqual(added.length);
  });

  test('uses each of the harder kinds the show used', () => {
    for (const kind of ['rebus', 'lettered', 'soundalike'] as const) {
      expect(added.filter((spec) => spec.kind === kind).length).toBeGreaterThan(0);
    }
  });

  test('has Mr Fries in more than half of this batch on its own', () => {
    expect(friesShareOk(CATCHPHRASE_SPECS.slice(0, FOURTH_END), THIRD_END)).toBe(true);
  });

  test('offers no option the pack already uses, as an answer or a wrong one', () => {
    // The third batch included: its options are the ones the office saw last.
    expect(repeats(added, before)).toEqual([]);
  });

  test('the repeat check reaches the third batch, however an option is written', () => {
    // The deny half. The third batch's last puzzle is the newest thing in the
    // pack; if `before` stopped short of it, the first two would come back empty.
    const latest = third[third.length - 1];
    if (latest === undefined) throw new Error('no third batch');
    const wrong = latest.incorrect[2] ?? '';
    const fixture = (incorrect: string[]): CatchphraseSpec => ({
      slug: 'fixture',
      correct: 'A saying nobody uses',
      incorrect,
      difficulty: 'hard',
      scene: 'A hill.',
    });
    expect(repeats([fixture(['One', `${wrong.toLowerCase()}?`, 'Three'])], before)).toHaveLength(1);
    expect(repeats([fixture([latest.correct, 'Two', 'Three'])], before)).toHaveLength(1);
    expect(repeats([fixture([latest.correct, 'Two', 'Three'])], CATCHPHRASE_SPECS.slice(0, HARDER_END))).toEqual([]);
    expect(repeats([fixture(['One', 'Two', 'Three'])], before)).toEqual([]);
  });

  test('has not been drawn yet, or has a picked drawing — never half of one', () => {
    for (const spec of added) expect(spec.seed === undefined || [1, 2, 3].includes(spec.seed)).toBe(true);
  });
});

/*
  The fifth batch — 9 October 2026. Sixty more after the fourth, written while
  the fourth was drawn but not yet picked, on the fourth's rules and its lean:
  docs/decisions/catchphrase-batch-5.md. Picked and pinned by hash with the
  fourth, 12 October 2026.
*/
describe('the fifth batch', () => {
  const before = CATCHPHRASE_SPECS.slice(0, FOURTH_END);
  // Bounded once the sixth went on the end, 17 October 2026.
  const added = CATCHPHRASE_SPECS.slice(FOURTH_END, FIFTH_END);
  const fourth = CATCHPHRASE_SPECS.slice(THIRD_END, FOURTH_END);
  const hard = (specs: CatchphraseSpec[]) => specs.filter((spec) => spec.difficulty === 'hard').length;

  test('is sixty puzzles', () => {
    expect(added).toHaveLength(60);
  });

  test('its 60 prompts are exactly as drawn', () => {
    // Pinned once picked and shipped, 12 October 2026, with the fourth.
    const hash = createHash('sha256')
      .update(CATCHPHRASE_SPECS.slice(FOURTH_END, FIFTH_END).map(promptFor).join('\n'))
      .digest('hex');
    expect(hash).toBe('e1ecf32f6f9a3e31dcd1b7d4482c7fc565ced1078c19af4a3671764790a1767e');
  });

  test('is medium or hard, never easy', () => {
    expect(added.filter((spec) => spec.difficulty === 'easy').map((spec) => spec.slug)).toEqual([]);
  });

  test('keeps the fourth batch\'s lean: mostly hard, and no smaller a share of hard than the fourth', () => {
    expect(hard(added) * 2).toBeGreaterThan(added.length);
    expect(hard(added) * fourth.length).toBeGreaterThanOrEqual(hard(fourth) * added.length);
  });

  test('says what kind each puzzle is, and no more than a third are one literal scene', () => {
    expect(added.filter((spec) => spec.kind === undefined).map((spec) => spec.slug)).toEqual([]);
    expect(added.filter((spec) => spec.kind === 'scene').length * 3).toBeLessThanOrEqual(added.length);
  });

  test('uses each of the harder kinds the show used', () => {
    for (const kind of ['rebus', 'lettered', 'soundalike'] as const) {
      expect(added.filter((spec) => spec.kind === kind).length).toBeGreaterThan(0);
    }
  });

  test('has Mr Fries in more than half of this batch on its own', () => {
    expect(friesShareOk(CATCHPHRASE_SPECS.slice(0, FIFTH_END), FOURTH_END)).toBe(true);
  });

  test('offers no option the pack already uses, as an answer or a wrong one', () => {
    // The fourth batch included, though it is not yet picked: its options are
    // the next ones the office will see.
    expect(repeats(added, before)).toEqual([]);
  });

  test('the repeat check reaches the fourth batch, however an option is written', () => {
    // The deny half. If `before` stopped at the third batch, the first two
    // would come back empty.
    const latest = fourth[fourth.length - 1];
    if (latest === undefined) throw new Error('no fourth batch');
    const wrong = latest.incorrect[1] ?? '';
    const fixture = (incorrect: string[]): CatchphraseSpec => ({
      slug: 'fixture',
      correct: 'A saying nobody uses',
      incorrect,
      difficulty: 'hard',
      scene: 'A hill.',
    });
    expect(repeats([fixture(['One', 'Two', `${wrong.toUpperCase()}.`])], before)).toHaveLength(1);
    expect(repeats([fixture(['One', latest.correct, 'Three'])], before)).toHaveLength(1);
    expect(repeats([fixture(['One', latest.correct, 'Three'])], CATCHPHRASE_SPECS.slice(0, THIRD_END))).toEqual([]);
    expect(repeats([fixture(['One', 'Two', 'Three'])], before)).toEqual([]);
  });

  test('has not been drawn yet, or has a picked drawing — never half of one', () => {
    for (const spec of added) expect(spec.seed === undefined || [1, 2, 3].includes(spec.seed)).toBe(true);
  });
});

/**
 * How many options in `specs` contain a Blankety Blank phrase or sit inside
 * one. Greg plays that round blind as well, so an option that carries one of
 * its phrases gives a blank away. `blanks-core.test.ts` holds every Catchphrase
 * answer to this; from the sixth batch on, the wrong options are held to it
 * too. A count, never the options: a failure must not print a phrase.
 */
function blankClashes(specs: CatchphraseSpec[]): number {
  return specs
    .flatMap((spec) => [spec.correct, ...spec.incorrect])
    .filter((option) => BLANK_SPECS.some((blank) => overlapsWith(blank.phrase, option))).length;
}

/*
  The sixth batch — 17 October 2026. Sixty more after the fifth, on the fifth's
  mix: the fourth and fifth measured inside the target band once live —
  docs/decisions/catchphrase-batch-6.md. Drawn, picked and pinned by hash on
  17 October 2026.

  Every assertion here reports counts or spec numbers, never a slug or an
  option, so a failing run spoils nothing for somebody who plays blind.
*/
describe('the sixth batch', () => {
  const before = CATCHPHRASE_SPECS.slice(0, FIFTH_END);
  const added = CATCHPHRASE_SPECS.slice(FIFTH_END);
  const fifth = CATCHPHRASE_SPECS.slice(FOURTH_END, FIFTH_END);
  const hard = (specs: CatchphraseSpec[]) => specs.filter((spec) => spec.difficulty === 'hard').length;
  const numbers = (specs: CatchphraseSpec[]) => specs.map((spec) => CATCHPHRASE_SPECS.indexOf(spec) + 1);
  const fixture = (incorrect: string[]): CatchphraseSpec => ({
    slug: 'fixture',
    correct: 'A saying nobody uses',
    incorrect,
    difficulty: 'hard',
    scene: 'A hill.',
  });

  test('is sixty puzzles', () => {
    expect(added.length).toBe(60);
  });

  test('its 60 prompts are exactly as drawn', () => {
    // Pinned once picked, 17 October 2026, as the fourth and fifth were. The
    // five dropped puzzles are pinned too: they stay in the list as drawn.
    const hash = createHash('sha256')
      .update(CATCHPHRASE_SPECS.slice(FIFTH_END, SIXTH_END).map(promptFor).join('\n'))
      .digest('hex');
    expect(hash).toBe('be85330a3795a0a69daa276bb170c7a3a9c853833655f8a6f19db2524aa90212');
  });

  test('is medium or hard, never easy', () => {
    expect(numbers(added.filter((spec) => spec.difficulty === 'easy'))).toEqual([]);
  });

  test("keeps the fifth batch's lean: mostly hard, and no smaller a share of hard than the fifth", () => {
    expect(hard(added) * 2).toBeGreaterThan(added.length);
    expect(hard(added) * fifth.length).toBeGreaterThanOrEqual(hard(fifth) * added.length);
  });

  test('says what kind each puzzle is, and no more than a third are one literal scene', () => {
    expect(numbers(added.filter((spec) => spec.kind === undefined))).toEqual([]);
    expect(added.filter((spec) => spec.kind === 'scene').length * 3).toBeLessThanOrEqual(added.length);
  });

  test('uses each of the harder kinds the show used', () => {
    for (const kind of ['rebus', 'lettered', 'soundalike'] as const) {
      expect(added.filter((spec) => spec.kind === kind).length).toBeGreaterThan(0);
    }
  });

  test('has Mr Fries in more than half of this batch on its own', () => {
    expect(friesShareOk(CATCHPHRASE_SPECS, FIFTH_END)).toBe(true);
  });

  test('offers no option the pack already uses, as an answer or a wrong one', () => {
    // Dropped puzzles included: they stay in the list, so their options count.
    expect(repeats(added, before).length).toBe(0);
  });

  test('the repeat check reaches the fifth batch, however an option is written', () => {
    // The deny half. If `before` stopped at the fourth batch, the first two
    // would come back empty.
    const latest = fifth[fifth.length - 1];
    if (latest === undefined) throw new Error('no fifth batch');
    const wrong = latest.incorrect[0] ?? '';
    expect(repeats([fixture([`  ${wrong.toLowerCase()}!`, 'Two', 'Three'])], before).length).toBe(1);
    expect(repeats([fixture(['One', 'Two', latest.correct])], before).length).toBe(1);
    expect(repeats([fixture(['One', 'Two', latest.correct])], CATCHPHRASE_SPECS.slice(0, FOURTH_END)).length).toBe(0);
    expect(repeats([fixture(['One', 'Two', 'Three'])], before).length).toBe(0);
  });

  test('no option, right or wrong, carries a Blankety Blank phrase', () => {
    expect(blankClashes(added)).toBe(0);
  });

  test('the Blankety Blank check catches a phrase either way round, and passes a clean option', () => {
    // The deny half, and the allow half beside it: a check that matched
    // nothing would pass the test above.
    const phrase = BLANK_SPECS.map((blank) => blank.phrase).find((each) => each.split(' ').length >= 3);
    if (phrase === undefined) throw new Error('no Blankety Blank phrase of three words');
    const firstTwo = phrase.split(' ').slice(0, 2).join(' ');
    expect(blankClashes([fixture([phrase.toUpperCase(), 'Two', 'Three'])])).toBe(1);
    expect(blankClashes([fixture(['One', `${phrase}, and then some`, 'Three'])])).toBe(1);
    expect(blankClashes([fixture(['One', 'Two', firstTwo])])).toBe(1);
    expect(blankClashes([fixture(['One', 'Two', 'Three'])])).toBe(0);
  });

  test('has not been drawn yet, or has a picked drawing — never half of one', () => {
    for (const spec of added) expect(spec.seed === undefined || [1, 2, 3].includes(spec.seed)).toBe(true);
  });
});
