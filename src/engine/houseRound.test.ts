import { describe, expect, test } from 'vitest';
import type { PackId, PackSummary } from '../questions/types';
import { TEST_SHOT, type Shot } from './cannon';
import {
  ENDINGS,
  HOUSE_DEFAULTS,
  planRound,
  readRoundSettings,
  ROUND_LENGTHS,
  roundLine,
  startingSettings,
  type RoundPlan,
  type RoundSettings,
} from './houseRound';
import { createRoom, DURATION_CHOICES, LEVELS } from './state';

/**
 * The house round: what a device remembers, what a lobby starts from, what is
 * really played, and the line that says it. docs/decisions/house-round.md.
 */

function pack(id: PackId, counts = { easy: 40, medium: 40, hard: 40 }, count = 120): PackSummary {
  return { id, title: id, blurb: '', count, counts, ...(id === 'picture' ? { jigsawCount: 48 } : {}) };
}

const SCIENCE = pack('science');
const SURVEY = pack('survey', { easy: 0, medium: 40, hard: 0 }, 40);
const TUNES = pack('tunes');
const PICTURE = pack('picture');

const USUAL: RoundSettings = {
  count: 15,
  level: 'ramp',
  durationSecs: 15,
  ending: 'standoff',
  steal: true,
  chaser: true,
};

const NOTHING = { jigsaw: false, double: false, shots: [] as readonly Shot[] };

function plan(settings: RoundSettings, on: PackSummary | null, tonight: Partial<typeof NOTHING> = {}): RoundPlan {
  return planRound(settings, { pack: on, ...NOTHING, ...tonight });
}

function line(settings: RoundSettings, on: PackSummary | null, tonight: Partial<typeof NOTHING> = {}): string {
  const chosen = { ...NOTHING, ...tonight };
  return roundLine(on?.id ?? null, plan(settings, on, tonight), chosen.shots).join(' · ');
}

describe('what a device may remember', () => {
  test('a round trip gives back what was stored', () => {
    expect(readRoundSettings(JSON.parse(JSON.stringify(USUAL)))).toEqual(USUAL);
  });

  test.each([null, undefined, 'ramp', 15, [], true])('%j is nothing remembered', (value) => {
    expect(readRoundSettings(value)).toBeNull();
  });

  test.each([
    ['a level withdrawn from the picker', { level: 'easy' }, 'level'],
    ['a length the buttons do not offer', { count: 7 }, 'count'],
    ['a length that is not a number', { count: '20' }, 'count'],
    ['a clock the picker does not offer', { durationSecs: 12 }, 'durationSecs'],
    ['an ending nobody has built', { ending: 'sudden-death' }, 'ending'],
    ['a steal that is not a yes or a no', { steal: 'yes' }, 'steal'],
    ['a chaser that is not a yes or a no', { chaser: 1 }, 'chaser'],
  ] as const)('%s falls back on its own, and the rest is kept', (_, stale, key) => {
    expect(readRoundSettings({ ...USUAL, ...stale })).toEqual({ ...USUAL, [key]: HOUSE_DEFAULTS[key] });
  });

  test('the pack, The Double, the jigsaw and the Slop Cannon are dropped, whoever wrote them', () => {
    const read = readRoundSettings({ ...USUAL, packId: 'science', double: true, jigsaw: true, shots: ['test-shot'] });
    expect(Object.keys(read ?? {}).sort()).toEqual(['chaser', 'count', 'durationSecs', 'ending', 'level', 'steal']);
  });

  test('everything the pickers offer is something that can be remembered', () => {
    for (const count of ROUND_LENGTHS) expect(readRoundSettings({ ...USUAL, count })?.count).toBe(count);
    for (const level of LEVELS) expect(readRoundSettings({ ...USUAL, level })?.level).toBe(level);
    for (const durationSecs of DURATION_CHOICES) {
      expect(readRoundSettings({ ...USUAL, durationSecs })?.durationSecs).toBe(durationSecs);
    }
    for (const ending of ENDINGS) expect(readRoundSettings({ ...USUAL, ending })?.ending).toBe(ending);
  });
});

describe('what a lobby starts from', () => {
  const FRESH = createRoom('HKQ7');

  test('a brand-new device in a new room: the same defaults as before any of this', () => {
    expect(startingSettings(FRESH, false, null)).toEqual({
      count: 15,
      level: 'ramp',
      durationSecs: 10,
      ending: 'top',
      steal: false,
      chaser: false,
    });
  });

  test('a new room starts from what this device remembers', () => {
    expect(startingSettings(FRESH, false, USUAL)).toEqual(USUAL);
  });

  test("a room's own last round beats the device: its ending, its clock, its steals and its chaser", () => {
    const played = { ...FRESH, wagerEnabled: true, durationSecs: 22, leadInSecs: 2 };
    expect(startingSettings(played, true, USUAL)).toEqual({
      ...USUAL,
      durationSecs: 20,
      ending: 'stakes',
      steal: false,
      chaser: false,
    });
  });

  test('including a last round that ended on the last answer, with everything off', () => {
    // The case the room document cannot show on its own: it reads exactly like
    // a room nobody has played in.
    expect(startingSettings({ ...FRESH, durationSecs: 12, leadInSecs: 2 }, true, USUAL)).toMatchObject({
      durationSecs: 10,
      ending: 'top',
      steal: false,
      chaser: false,
    });
  });

  test('the length and the level are never on the room, so those are the device’s either way', () => {
    const remembered = { ...USUAL, count: 25, level: 'medium' as const };
    expect(startingSettings(FRESH, true, remembered)).toMatchObject({ count: 25, level: 'medium' });
  });

  test('both endings on from an older room reads as Share or Shaft', () => {
    const both = { ...FRESH, wagerEnabled: true, standoffEnabled: true };
    expect(startingSettings(both, true, null).ending).toBe('standoff');
  });

  test('a clock the picker does not offer is not carried', () => {
    expect(startingSettings({ ...FRESH, durationSecs: 7, leadInSecs: 2 }, true, USUAL).durationSecs).toBe(15);
    expect(startingSettings({ ...FRESH, durationSecs: 7, leadInSecs: 2 }, true, null).durationSecs).toBe(10);
  });
});

describe('what is really played', () => {
  test('with no pack chosen, what was picked', () => {
    expect(plan(USUAL, null)).toEqual({
      count: 15,
      level: 'ramp',
      durationSecs: 15,
      wagerEnabled: false,
      stealEnabled: true,
      jigsawEnabled: false,
      standoffEnabled: true,
      chaserEnabled: true,
      doubleEnabled: false,
      cannon: {},
    });
  });

  test('a pack that fixes its own clock', () => {
    expect(plan({ ...USUAL, durationSecs: 20 }, TUNES).durationSecs).toBe(10);
    expect(plan({ ...USUAL, durationSecs: 20 }, SCIENCE).durationSecs).toBe(20);
  });

  test('a pack with fewer than the length asked for', () => {
    expect(plan({ ...USUAL, level: 'medium' }, pack('science', { easy: 0, medium: 12, hard: 0 })).count).toBe(12);
  });

  test('a level the pack has none of is played as it comes, rather than leaving a dead Start', () => {
    const none = pack('science', { easy: 40, medium: 0, hard: 0 }, 40);
    expect(plan({ ...USUAL, level: 'medium' }, none)).toMatchObject({ level: 'mixed', count: 15 });
  });

  test('a pack with nothing in it at all is a round of nothing, which Start refuses', () => {
    expect(plan(USUAL, pack('science', { easy: 0, medium: 0, hard: 0 }, 0)).count).toBe(0);
    expect(plan(USUAL, pack('survey', { easy: 0, medium: 0, hard: 0 }, 0)).count).toBe(0);
  });

  test('Survey Says: its own ten, at no level, with no stakes, no steals and no Mr Fries', () => {
    expect(plan({ ...USUAL, count: 25, ending: 'stakes' }, SURVEY)).toMatchObject({
      count: 10,
      level: 'mixed',
      wagerEnabled: false,
      standoffEnabled: false,
      stealEnabled: false,
      chaserEnabled: false,
    });
  });

  test('Survey Says keeps Share or Shaft and the clock', () => {
    expect(plan(USUAL, SURVEY)).toMatchObject({ standoffEnabled: true, durationSecs: 15 });
  });

  test('the jigsaw is Fine Art’s alone, whatever is left switched on', () => {
    expect(plan(USUAL, PICTURE, { jigsaw: true })).toMatchObject({ jigsawEnabled: true, count: 15 });
    expect(plan(USUAL, SCIENCE, { jigsaw: true }).jigsawEnabled).toBe(false);
  });

  test('the jigsaw plays the pictures that can be cut up', () => {
    const few = { ...PICTURE, jigsawCount: 8 };
    expect(plan(USUAL, few, { jigsaw: true }).count).toBe(8);
  });

  test('planning never changes what was picked', () => {
    const picked = { ...USUAL, ending: 'stakes' as const };
    plan(picked, SURVEY);
    expect(picked).toEqual({ ...USUAL, ending: 'stakes' });
  });
});

describe('the line', () => {
  test('reads as the one Greg was shown', () => {
    expect(line({ ...USUAL, steal: false, chaser: false }, SCIENCE)).toBe(
      '15 questions · 15 seconds · The Ladder · ends on a final',
    );
  });

  test('on a brand-new device', () => {
    expect(line(HOUSE_DEFAULTS, null)).toBe('15 questions · 10 seconds · The Ladder · ends on the last answer');
  });

  test('with everything on', () => {
    expect(line(USUAL, PICTURE, { double: true, jigsaw: true, shots: [TEST_SHOT] })).toBe(
      '15 questions this half · 15 seconds · The Ladder · The Double · ends on a final · first right answer steals · '
        + 'against Mr Fries · as a jigsaw · Slop Cannon: Test shot',
    );
  });

  test('says what Survey Says will play, not what was picked', () => {
    expect(line({ ...USUAL, count: 25, ending: 'stakes' }, SURVEY)).toBe(
      '10 questions · 15 seconds · ends on the last answer',
    );
  });

  test('one question is not “1 questions”', () => {
    expect(line({ ...USUAL, level: 'medium' }, pack('science', { easy: 0, medium: 1, hard: 0 }))).toMatch(/^1 question ·/);
  });

  /*
    Criterion 4 as a property. Two rounds that differ in anything the lobby can
    set must never read the same: then nothing can be on that the line does not
    say. Every combination, on every kind of pack.
  */
  test.each([
    ['no pack yet', null],
    ['an ordinary pack', SCIENCE],
    ['a pack that fixes its clock', TUNES],
    ['Fine Art', PICTURE],
    ['Survey Says', SURVEY],
  ] as const)('on %s, no two rounds that play differently read the same', (_, on) => {
    const said = new Map<string, string>();
    const bools = [false, true];
    let rounds = 0;
    for (const count of ROUND_LENGTHS)
      for (const level of LEVELS)
        for (const durationSecs of DURATION_CHOICES)
          for (const ending of ENDINGS)
            for (const steal of bools)
              for (const chaser of bools)
                for (const double of bools)
                  for (const jigsaw of bools)
                    for (const shots of [[], [TEST_SHOT]]) {
                      const settings = { count, level, durationSecs, ending, steal, chaser };
                      const planned = JSON.stringify(plan(settings, on, { double, jigsaw, shots }));
                      const words = line(settings, on, { double, jigsaw, shots });
                      expect(said.get(words) ?? planned, words).toBe(planned);
                      said.set(words, planned);
                      rounds += 1;
                    }
    expect(rounds).toBe(4 * 3 * 3 * 3 * 2 ** 5);
    expect(new Set(said.values()).size).toBe(said.size);
  });
});
