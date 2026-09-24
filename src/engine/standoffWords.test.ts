import { describe, expect, test } from 'vitest';
import type { Standoff } from './standoff';
import { standoffWords } from './standoffWords';

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
