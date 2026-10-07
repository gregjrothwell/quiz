import { describe, expect, test } from 'vitest';
import {
  PAUSE_BELOW,
  RESUME_AT,
  PUZZLES_PER_SHEET,
  cellLabel,
  parseBattery,
  sheetsFor,
  shouldDraw,
} from './draw-overnight';
import type { CatchphraseSpec } from './hand-catchphrase-data';

/*
  Greg plays Catchphrase blind. Every slug below is invented, and the test that
  matters most is that a contact sheet's labels are numbers, never a slug — the
  sheet is for the morning pick, and its labels end up in tool output.
*/

const ON_MAINS = `Now drawing from 'AC Power'
 -InternalBattery-0 (id=1)	82%; charging; 0:40 remaining present: true`;
const ON_BATTERY = `Now drawing from 'Battery Power'
 -InternalBattery-0 (id=1)	44%; discharging; 4:18 remaining present: true`;

function spec(slug: string, seed?: number): CatchphraseSpec {
  return {
    slug,
    correct: 'Invented',
    incorrect: ['One', 'Two', 'Three'],
    difficulty: 'medium',
    scene: 'An invented scene.',
    ...(seed === undefined ? {} : { seed }),
  };
}

describe('parseBattery', () => {
  test('reads the power source and the charge from pmset', () => {
    expect(parseBattery(ON_MAINS)).toEqual({ onMains: true, percent: 82 });
    expect(parseBattery(ON_BATTERY)).toEqual({ onMains: false, percent: 44 });
  });

  test('says it cannot tell rather than guessing, on a Mac with no battery line', () => {
    expect(parseBattery("Now drawing from 'AC Power'")).toEqual({ onMains: true, percent: null });
    expect(parseBattery('')).toBeNull();
  });
});

describe('shouldDraw', () => {
  test('draws on mains above the floor, and pauses on battery or below it', () => {
    expect(shouldDraw({ onMains: true, percent: PAUSE_BELOW }, false)).toBe(true);
    expect(shouldDraw({ onMains: true, percent: PAUSE_BELOW - 1 }, false)).toBe(false);
    expect(shouldDraw({ onMains: false, percent: 90 }, false)).toBe(false);
  });

  test('once paused, waits for real headroom rather than flapping at the floor', () => {
    expect(shouldDraw({ onMains: true, percent: PAUSE_BELOW + 1 }, true)).toBe(false);
    expect(shouldDraw({ onMains: true, percent: RESUME_AT }, true)).toBe(true);
  });

  test('a desktop Mac with no battery draws whenever it is on mains', () => {
    expect(shouldDraw({ onMains: true, percent: null }, false)).toBe(true);
    expect(shouldDraw({ onMains: true, percent: null }, true)).toBe(true);
  });
});

describe('sheetsFor', () => {
  const specs = Array.from({ length: 30 }, (_, i) => spec(`cp-invented-${i + 1}`, i < 5 ? 1 : undefined));
  const drawn = new Set(specs.map((s) => s.slug));

  test('puts every puzzle still waiting for a pick on a sheet, three versions each', () => {
    const sheets = sheetsFor(specs, (slug) => drawn.has(slug));
    const cells = sheets.flat();
    // #then the 25 without a seed, three versions each, and none already picked
    expect(cells).toHaveLength(25 * 3);
    expect(cells.some((cell) => cell.slug === 'cp-invented-1')).toBe(false);
  });

  test(`fits ${PUZZLES_PER_SHEET} puzzles to a sheet`, () => {
    const sheets = sheetsFor(specs, (slug) => drawn.has(slug));
    expect(sheets.map((sheet) => sheet.length / 3)).toEqual([4, 4, 4, 4, 4, 4, 1]);
  });

  test('numbers a puzzle by its place in the spec list, so the morning pick can find it', () => {
    const [first] = sheetsFor(specs, (slug) => drawn.has(slug));
    expect(first?.[0]).toMatchObject({ number: 6, seed: 1, slug: 'cp-invented-6' });
  });

  test('leaves out a puzzle that has not been drawn', () => {
    const sheets = sheetsFor(specs, (slug) => slug !== 'cp-invented-6');
    expect(sheets.flat().some((cell) => cell.number === 6)).toBe(false);
  });
});

describe('cellLabel', () => {
  test('is a number and a version, never the slug — the round is blind', () => {
    const label = cellLabel({ number: 14, seed: 2, slug: 'cp-invented-14', path: '/x.png' });
    expect(label).toBe('14 · v2');
    expect(label).not.toContain('invented');
  });
});
