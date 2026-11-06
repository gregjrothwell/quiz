import { describe, expect, test } from 'vitest';
import type { Standoff } from './standoff';
import { standoffWords, tieWords } from './standoffWords';

const NAMES: Record<string, string> = { a: 'Alex', b: 'Bea', c: 'Cal' };
const nameOf = (uid: string): string => NAMES[uid] ?? uid;

function settled(picks: Standoff['picks']): Standoff {
  return {
    finalists: ['a', 'b'],
    stakes: { a: 26_700, b: 22_600 },
    stage: 'revealed',
    sealed: ['a', 'b'],
    picks,
  };
}

const say = (picks: Standoff['picks'], youUid: string | null, leaderAfter: string | null = null) =>
  standoffWords({ standoff: settled(picks), nameOf, youUid, leaderAfter });

describe('standoffWords', () => {
  test('says nothing before the reveal', () => {
    expect(say(null, 'a')).toBeNull();
  });

  test('a share, to the room and to the two who made it', () => {
    expect(say({ a: 'share', b: 'share' }, 'c')?.headline).toBe('They shared — 24,650 each, joint winners.');
    expect(say({ a: 'share', b: 'share' }, 'a')?.headline).toBe('You both shared — 24,650 each, joint winners.');
  });

  // The wager's fifth trap: the biggest swing must be said, in words, to the
  // person it happened to.
  test('a shafting is told to the one who lost it, by name', () => {
    expect(say({ a: 'share', b: 'shaft' }, 'a')?.headline).toBe('Bea shafted you. You leave with nothing.');
  });

  test('and to the one who did it, and to everybody watching', () => {
    expect(say({ a: 'share', b: 'shaft' }, 'b')?.headline).toBe('You shafted Alex. All 49,300 is yours.');
    expect(say({ a: 'share', b: 'shaft' }, 'c')?.headline).toBe('Bea shafted Alex and takes all 49,300.');
  });

  test('both shafting says who it handed the round to', () => {
    expect(say({ a: 'shaft', b: 'shaft' }, 'c', 'c')?.headline).toBe('Both shafted. 49,300 gone — you win it.');
    expect(say({ a: 'shaft', b: 'shaft' }, 'a', 'c')?.headline).toBe('You both shafted. 49,300 gone — Cal wins it.');
  });

  test('a pick that never arrived is said, and what it counted as', () => {
    const words = say({ a: null, b: 'shaft' }, 'c');
    expect(words?.headline).toBe('Bea shafted Alex and takes all 49,300.');
    expect(words?.note).toBe('Alex never picked, which counts as share.');
    expect(say({ a: null, b: 'share' }, 'a')?.note).toBe('You never picked, which counts as share.');
    expect(say({ a: 'share', b: 'share' }, 'a')?.note).toBeNull();
  });
});

describe('tieWords', () => {
  const byRight = {
    tied: ['b', 'c'],
    picked: ['b'],
    score: 7_300,
    decidedBy: 'right' as const,
    rightOf: { b: 8, c: 7 },
  };

  test('nothing without a tie', () => {
    expect(tieWords({ tie: null, nameOf, youUid: 'a' })).toBeNull();
  });

  test('more right: to the room, to the one through and to the one out', () => {
    expect(tieWords({ tie: byRight, nameOf, youUid: 'a' })).toBe('Bea and Cal tied on 7,300. Bea got more right, 8 to 7.');
    expect(tieWords({ tie: byRight, nameOf, youUid: 'b' })).toBe('You and Cal tied on 7,300. You got more right, 8 to 7.');
    expect(tieWords({ tie: byRight, nameOf, youUid: 'c' })).toBe('You and Bea tied on 7,300. Bea got more right, 8 to 7.');
  });

  test('speed', () => {
    const tie = { ...byRight, decidedBy: 'speed' as const, rightOf: { b: 5, c: 5 } };
    expect(tieWords({ tie, nameOf, youUid: 'a' })).toBe('Bea and Cal tied on 7,300, with 5 right each. Bea was faster.');
    expect(tieWords({ tie, nameOf, youUid: 'b' })).toBe('You and Cal tied on 7,300, with 5 right each. You were faster.');
  });

  test('the coin', () => {
    const tie = { ...byRight, decidedBy: 'coin' as const, rightOf: { b: 0, c: 0 } };
    expect(tieWords({ tie, nameOf, youUid: 'a' })).toBe('Bea and Cal tied on 7,300. Level on right answers and speed too, so a coin picked Bea.');
    expect(tieWords({ tie, nameOf, youUid: 'b' })).toBe('You and Cal tied on 7,300. Level on right answers and speed too, so a coin picked you.');
  });

  test('three tied for one seat or two', () => {
    const three = { tied: ['a', 'b', 'c'], picked: ['a', 'b'], score: 500, rightOf: { a: 9, b: 8, c: 7 } };
    expect(tieWords({ tie: { ...three, decidedBy: 'right' }, nameOf, youUid: null })).toBe(
      'Alex, Bea and Cal tied on 500. Alex and Bea got the most right.',
    );
    expect(tieWords({ tie: { ...three, decidedBy: 'speed' }, nameOf, youUid: 'b' })).toBe(
      'You, Alex and Cal tied on 500. You and Alex got the most right, then the fastest.',
    );
    expect(tieWords({ tie: { ...three, decidedBy: 'coin' }, nameOf, youUid: null })).toBe(
      'Alex, Bea and Cal tied on 500. Level on right answers and speed too, so a coin picked Alex and Bea.',
    );
  });
});
