import { describe, expect, test } from 'vitest';
import { freshness, isDue, liveSeason, notificationFor, type PlayedRound } from './freshness-core';

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

/*
  Random Round's share — PROJ-204, 27 November 2026. A Random Round is kept
  as `packId: random` with no source per question, so until this the check
  counted it against nothing: Sleeves read "played 0" while Random Round, the
  most played round, was taking about seven a week from it.
*/
describe('freshness counts what Random Round takes from each source', () => {
  // Only Random Rounds in the window: two of fifteen and one of ten.
  const onlyRandom = [round('random', 1, 15), round('random', 2, 15), round('random', 3, 10)];

  test('each source gets its quota of every Random Round: 3,3,3,2,2,2 of 15 and 2,2,2,2,1,1 of 10', () => {
    const rows = freshness({
      packs: [
        { id: 'screens', title: 'On the box', ids: ids('m', 400) },
        { id: 'sleeves', title: 'Sleeves', ids: ids('s', 200) },
        { id: 'prices', title: 'The Price Was Right', ids: ids('p', 150) },
      ],
      asked: {},
      rounds: onlyRandom,
      now: NOW,
    });
    const row = (pack: string) => rows.find((entry) => entry.pack === pack);
    // Sleeves is second in RANDOM_SOURCES: 3 + 3 + 2 = 8 in a fortnight.
    expect(row('sleeves')).toMatchObject({ played: 3, playedRandom: 3, perWeek: 4 });
    // The Price Was Right is last: 2 + 2 + 1 = 5.
    expect(row('prices')).toMatchObject({ played: 3, playedRandom: 3, perWeek: 2.5 });
    expect(row('screens')).toMatchObject({ perWeek: 4 });
  });

  test('arms the alarm on a pack played only through Random Round', () => {
    // Before PROJ-204 this read played 0, so it could never be low.
    const [row] = freshness({
      packs: [{ id: 'sleeves', title: 'Sleeves', ids: ids('s', 212) }],
      asked: { sleeves: ids('s', 190) },
      rounds: onlyRandom,
      now: NOW,
    });
    expect(row).toMatchObject({ unseen: 22, played: 3, low: true });
  });

  test('a pack that is not a Random source gets nothing from them', () => {
    // Fine Art is not in RANDOM_SOURCES. One question left and three Random
    // Rounds in the window: still unplayed, still not low.
    const [row] = freshness({
      packs: [{ id: 'picture', title: 'Fine Art', ids: ids('p', 49) }],
      asked: { picture: ids('p', 48) },
      rounds: onlyRandom,
      now: NOW,
    });
    expect(row).toMatchObject({ played: 0, playedRandom: 0, perWeek: 0, weeksLeft: null, low: false });
  });

  test('a short Random Round leaves out the sources its quota skips', () => {
    // Four questions: 1,1,1,1,0,0, so Blankety Blank and The Price Was Right supply none.
    const rows = freshness({
      packs: [
        { id: 'catchphrase', title: 'Catchphrase', ids: ids('c', 50) },
        { id: 'blanks', title: 'Blankety Blank', ids: ids('b', 50) },
      ],
      asked: {},
      rounds: [round('random', 1, 4)],
      now: NOW,
    });
    expect(rows.find((row) => row.pack === 'catchphrase')).toMatchObject({ played: 1, perWeek: 0.5 });
    expect(rows.find((row) => row.pack === 'blanks')).toMatchObject({ played: 0, perWeek: 0 });
  });

  test('a share is not a round of that pack: round length stays its own rounds’ median', () => {
    // Catchphrase played twice on its own at 15 and four times inside Random
    // Round at 2 or 3 each. Taking the median of all six would call a round
    // two or three questions and multiply its fresh rounds five times or more.
    const [row] = freshness({
      packs: [{ id: 'catchphrase', title: 'Catchphrase', ids: ids('c', 233) }],
      asked: { catchphrase: ids('c', 203) },
      rounds: [
        round('catchphrase', 1, 15),
        round('catchphrase', 4, 15),
        ...[2, 3, 5, 6].map((daysAgo) => round('random', daysAgo, 15)),
      ],
      now: NOW,
    });
    // 30 + 4 × 2 = 38 in a fortnight is 19 a week; 30 unseen lasts 1.5 weeks.
    expect(row).toMatchObject({ roundLength: 15, freshRounds: 2, played: 6, playedRandom: 4, perWeek: 19, weeksLeft: 1.5 });
  });

  test('a Random Round older than the window counts for nothing', () => {
    const [row] = freshness({
      packs: [{ id: 'sleeves', title: 'Sleeves', ids: ids('s', 212) }],
      asked: { sleeves: ids('s', 190) },
      rounds: [round('random', 15)],
      now: NOW,
    });
    expect(row).toMatchObject({ played: 0, perWeek: 0, low: false });
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

describe('liveSeason', () => {
  test('passes over a probe season written to after the last round', () => {
    // 30 October 2026: check-rules wrote `rules-check` at 19:29, after the
    // last round at 11:55, and every pack read as unasked.
    expect(
      liveSeason([
        { season: 'season-2', latest: 1_793_274_909_147 },
        { season: 'rules-check', latest: 1_793_302_147_044 },
        { season: 'week-1999-W02', latest: 1_793_302_147_045 },
      ]),
    ).toBe('season-2');
  });

  test('takes the season most recently written to', () => {
    expect(
      liveSeason([
        { season: 'season-2', latest: 200 },
        { season: 'season-3', latest: 300 },
        { season: 'season-1', latest: 100 },
      ]),
    ).toBe('season-3');
  });

  test('is null when no season has been written to', () => {
    expect(liveSeason([{ season: 'rules-check', latest: 5 }, { season: 'season-1', latest: 0 }])).toBeNull();
  });
});
