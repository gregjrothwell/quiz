import { describe, expect, test } from 'vitest';
import { freshness, isDue, notificationFor, type PlayedRound } from './freshness-core';

/*
  Pack freshness — approved by Greg on 5 October 2026, the day Catchphrase (30
  of 30) and Sleeves (105 of 104) were both found spent with nothing having
  said so. docs/decisions/pack-freshness.md.
*/

const DAY = 86_400_000;
const NOW = new Date(2026, 9, 5, 9, 0).getTime();

const ids = (prefix: string, n: number): string[] =>
  Array.from({ length: n }, (_, i) => `${prefix}-${i}`);

const round = (packId: string, daysAgo: number, questions = 15): PlayedRound => ({
  packId,
  finishedAt: NOW - daysAgo * DAY,
  questions,
});

describe('freshness', () => {
  test('counts unseen as the pack’s ids nobody has been asked', () => {
    const [row] = freshness({
      packs: [{ id: 'sleeves', title: 'Sleeves', ids: ids('s', 104) }],
      // 105 asked against 104 published, as on 5 October: one asked id has
      // since left the pack, so it must not count against what is left.
      asked: { sleeves: [...ids('s', 104), 'retired-1'] },
      rounds: [round('sleeves', 5, 20)],
      now: NOW,
    });
    expect(row).toMatchObject({ size: 104, asked: 104, unseen: 0, freshRounds: 0, low: true });
  });

  test('measures a round by that pack’s recent rounds, else 15', () => {
    const rows = freshness({
      packs: [
        { id: 'tunes', title: 'Name that Tune', ids: ids('t', 100) },
        { id: 'flags', title: 'Flags', ids: ids('f', 60) },
      ],
      asked: {},
      rounds: [round('tunes', 1, 10), round('tunes', 2, 20), round('tunes', 3, 20)],
      now: NOW,
    });
    expect(rows.find((row) => row.pack === 'tunes')).toMatchObject({ roundLength: 20, freshRounds: 5 });
    expect(rows.find((row) => row.pack === 'flags')).toMatchObject({ roundLength: 15, freshRounds: 4 });
  });

  test('flags a played pack under two fresh rounds, and only a played one', () => {
    const rows = freshness({
      packs: [
        { id: 'catchphrase', title: 'Catchphrase', ids: ids('c', 30) },
        { id: 'picture', title: 'Fine Art', ids: ids('p', 49) },
        { id: 'screens', title: 'On the box', ids: ids('m', 296) },
      ],
      asked: { catchphrase: ids('c', 30), picture: ids('p', 40), screens: ids('m', 149) },
      rounds: [round('catchphrase', 0), round('screens', 3), round('picture', 30)],
      now: NOW,
    });
    const low = Object.fromEntries(rows.map((row) => [row.pack, row.low]));
    // Fine Art has one fresh round left, but nobody has played it in a fortnight.
    expect(low).toEqual({ catchphrase: true, picture: false, screens: false });
  });

  test('a pack with exactly two fresh rounds is not low; one question short is', () => {
    const at = (unseen: number) =>
      freshness({
        packs: [{ id: 'flags', title: 'Flags', ids: ids('f', 100) }],
        asked: { flags: ids('f', 100 - unseen) },
        rounds: [round('flags', 1)],
        now: NOW,
      })[0]?.low;
    expect(at(30)).toBe(false);
    expect(at(29)).toBe(true);
  });

  test('the threshold can be forced, which is how the alarm is proved', () => {
    const [row] = freshness({
      packs: [{ id: 'screens', title: 'On the box', ids: ids('m', 296) }],
      asked: { screens: ids('m', 149) },
      rounds: [round('screens', 3)],
      now: NOW,
      lowBelow: 100,
    });
    expect(row?.low).toBe(true);
  });

  test('lists the lowest first', () => {
    const rows = freshness({
      packs: [
        { id: 'a', title: 'A', ids: ids('a', 90) },
        { id: 'b', title: 'B', ids: ids('b', 30) },
      ],
      asked: {},
      rounds: [],
      now: NOW,
    });
    expect(rows.map((row) => row.pack)).toEqual(['b', 'a']);
  });
});

describe('notificationFor', () => {
  test('says nothing when nothing is low', () => {
    expect(notificationFor([])).toBeNull();
  });

  test('names each low pack and its fresh rounds', () => {
    const rows = freshness({
      packs: [
        { id: 'catchphrase', title: 'Catchphrase', ids: ids('c', 30) },
        { id: 'sleeves', title: 'Sleeves', ids: ids('s', 104) },
        { id: 'screens', title: 'On the box', ids: ids('m', 296) },
      ],
      asked: { catchphrase: ids('c', 30), sleeves: ids('s', 90) },
      rounds: [round('catchphrase', 0), round('sleeves', 5, 20), round('screens', 3)],
      now: NOW,
    });
    expect(notificationFor(rows)).toBe('Catchphrase: none fresh · Sleeves: 0.7 of a round');
  });
});

describe('isDue', () => {
  // 5 October 2026 is a Monday.
  const at = (day: number, hour: number, minute: number) => new Date(2026, 9, day, hour, minute);

  test('a weekday from 08:00, once', () => {
    expect(isDue(at(5, 7, 59), null)).toBe(false);
    expect(isDue(at(5, 8, 0), null)).toBe(true);
    expect(isDue(at(5, 17, 0), '2026-10-02')).toBe(true);
    expect(isDue(at(5, 17, 0), '2026-10-05')).toBe(false);
  });

  test('never at the weekend', () => {
    expect(isDue(at(10, 9, 0), null)).toBe(false);
    expect(isDue(at(11, 9, 0), null)).toBe(false);
  });

  test('a Mac that was off at 08:00 runs when it is next on', () => {
    // Off all morning, the app opened at 13:05: still today's run.
    expect(isDue(at(6, 13, 5), '2026-10-05')).toBe(true);
  });
});
