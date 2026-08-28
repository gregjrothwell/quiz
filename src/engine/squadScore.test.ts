import { describe, expect, test } from 'vitest';
import { sideFor, squadStandings } from './squadScore';
import type { Player } from './state';

function room(entries: Record<string, { squad?: string }>): Record<string, Player> {
  const players: Record<string, Player> = {};
  let joinedAt = 1;
  for (const [uid, entry] of Object.entries(entries)) {
    players[uid] = {
      name: uid,
      joinedAt: joinedAt++,
      ...(entry.squad === undefined ? {} : { squad: entry.squad }),
    };
  }
  return players;
}

describe('sideFor', () => {
  test('is your own squad when you have one', () => {
    expect(sideFor('Hermes', '')).toBe('Hermes');
  });

  test("is a Lurker's pick where they made one", () => {
    // The one thing the two tables are ever told differently: the week's row is
    // filed under whoever they sat with, and the season record still says
    // Lurkers. The live board has to follow the same rule or it disagrees with
    // the board it turns into.
    expect(sideFor('Lurkers', 'Bundae')).toBe('Bundae');
  });

  test('is Lurkers for a Lurker who has not picked a side', () => {
    // Lurkers is a squad in its own right, not an absence.
    expect(sideFor('Lurkers', '')).toBe('Lurkers');
  });

  test('is nothing for somebody who has never chosen a squad', () => {
    expect(sideFor('', '')).toBe('');
  });

  test('a stray `playingWith` cannot override a real squad', () => {
    // Only a Lurker is ever asked, and `withWhom` is sent empty by everybody
    // else — but session storage outlives a squad change, so somebody who was a
    // Lurker last week and is Hermes today must count for Hermes.
    expect(sideFor('Hermes', 'Bundae')).toBe('Hermes');
  });
});

describe('squadStandings', () => {
  test('adds up the room by side', () => {
    const players = room({
      greg: { squad: 'Hermes' },
      sam: { squad: 'Bundae' },
      alex: { squad: 'Hermes' },
    });
    const scores = { greg: 1_000, sam: 2_500, alex: 900 };

    expect(squadStandings(players, scores)).toEqual([
      { squad: 'Bundae', score: 2_500, players: 1, average: 2_500 },
      { squad: 'Hermes', score: 1_900, players: 2, average: 950 },
    ]);
  });

  test('ranks on the average, so the bigger squad cannot win by turning up', () => {
    // #given Hermes fielding three to Bundae's one, and out-scoring them on
    // the total by nearly two to one
    const players = room({
      greg: { squad: 'Hermes' },
      alex: { squad: 'Hermes' },
      rach: { squad: 'Hermes' },
      sam: { squad: 'Bundae' },
    });
    const scores = { greg: 2_000, alex: 1_800, rach: 1_600, sam: 3_000 };

    const rows = squadStandings(players, scores);

    // #then Bundae are ahead, because they are playing better — 3,000 each
    // against 1,800 each. On the raw total this read Hermes 5,400 to 3,000,
    // which is a board that rewards headcount rather than answers.
    expect(rows.map((row) => row.squad)).toEqual(['Bundae', 'Hermes']);
    expect(rows[0]?.average).toBe(3_000);
    expect(rows[1]?.average).toBe(1_800);
    expect(rows[1]?.score).toBe(5_400);
  });

  test('keeps the average unrounded, so the order is exact', () => {
    // Two sides a third of a point apart still have an order. Rounding here
    // would call them level and let the tiebreak on name decide it instead.
    const players = room({
      greg: { squad: 'Hermes' },
      alex: { squad: 'Hermes' },
      rach: { squad: 'Hermes' },
      sam: { squad: 'Bundae' },
    });
    const scores = { greg: 1, alex: 1, rach: 0, sam: 0 };

    const rows = squadStandings(players, scores);
    expect(rows[0]?.squad).toBe('Hermes');
    expect(rows[0]?.average).toBeCloseTo(2 / 3);
  });

  test('counts a player who has not scored yet', () => {
    // #given somebody in a squad with nothing on the board
    const players = room({ greg: { squad: 'Hermes' } });

    // #then the squad is still represented, on zero
    expect(squadStandings(players, {})).toEqual([
      { squad: 'Hermes', score: 0, players: 1, average: 0 },
    ]);
  });

  test('leaves out anybody who has not named a squad', () => {
    // #given a room where one player never chose one
    const players = room({ greg: { squad: 'Hermes' }, nobody: {} });
    const scores = { greg: 500, nobody: 9_000 };

    // #then their points are theirs alone — they are not a phantom squad, and
    // they are not quietly folded into somebody else's total
    expect(squadStandings(players, scores)).toEqual([
      { squad: 'Hermes', score: 500, players: 1, average: 500 },
    ]);
  });

  test('ignores a score belonging to nobody in the room', () => {
    // The same rule `roomStandings` applies, and for the same reason: nothing
    // checks membership on the way in, so a client can write a score to a room
    // it never joined.
    const players = room({ greg: { squad: 'Hermes' } });
    const scores = { greg: 500, stranger: 10_000 };

    expect(squadStandings(players, scores)).toEqual([
      { squad: 'Hermes', score: 500, players: 1, average: 500 },
    ]);
  });

  test('an empty room has no sides', () => {
    expect(squadStandings({}, {})).toEqual([]);
  });

  test('breaks a tie on the name, so the bar does not swap about between renders', () => {
    // Two squads level is an ordinary state in a live round, and a sort that
    // reorders equal rows makes the board twitch on every question. Level on
    // the average, which is what is being compared — the totals differ.
    const players = room({
      greg: { squad: 'Hermes' },
      alex: { squad: 'Hermes' },
      sam: { squad: 'Bundae' },
    });
    const scores = { greg: 1_000, alex: 1_000, sam: 1_000 };

    expect(squadStandings(players, scores).map((row) => row.squad)).toEqual([
      'Bundae',
      'Hermes',
    ]);
  });
});
