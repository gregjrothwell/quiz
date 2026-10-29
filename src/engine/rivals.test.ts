import { describe, expect, test } from 'vitest';
import { bankGame, foldRecords, type GameOutcome, type PlayerRecord } from './records';
import {
  RIVALS_CAP,
  foldRivals,
  meetRivals,
  answeredIn,
  nightAgainst,
  rivalsCaption,
  rivalsFrom,
  type Rival,
} from './rivals';

const NO_HONOURS = { fastest: 0, comeback: 0, loneWolf: 0, contrarian: 0 };

function outcome(overrides: Partial<GameOutcome> = {}): GameOutcome {
  return {
    name: 'Greg',
    gameId: 'game-2',
    score: 2_000,
    won: false,
    squad: '',
    honours: NO_HONOURS,
    ...overrides,
  };
}

function record(overrides: Partial<PlayerRecord> = {}): PlayerRecord {
  return {
    name: 'Greg',
    played: 1,
    wins: 0,
    points: 1_000,
    best: 1_000,
    lastGame: 'game-1',
    lastPlayed: 1_000,
    ...overrides,
  };
}

const NIGHT: Record<string, Rival> = {
  sam: { name: 'Sam', beaten: 4, lost: 1 },
  priya: { name: 'Priya', beaten: 1, lost: 3 },
};

describe('meetRivals', () => {
  test('counts a win, a loss and ignores a tie', () => {
    // #given a first round, ahead of Sam, behind Priya, level with Alex
    const rivals = meetRivals(undefined, 1_000, [
      { playerId: 'sam', name: 'Sam', score: 400 },
      { playerId: 'priya', name: 'Priya', score: 1_500 },
      { playerId: 'alex', name: 'Alex', score: 1_000 },
    ]);

    // #then only the two decisive results are stored
    expect(rivals).toEqual({
      sam: { name: 'Sam', beaten: 1, lost: 0 },
      priya: { name: 'Priya', beaten: 0, lost: 1 },
    });
  });

  test('adds the next round onto the map it already has', () => {
    const rivals = meetRivals(NIGHT, 800, [
      { playerId: 'sam', name: 'Sammy', score: 100 },
      { playerId: 'priya', name: 'Priya', score: 900 },
    ]);

    expect(rivals?.sam).toEqual({ name: 'Sammy', beaten: 5, lost: 1 });
    expect(rivals?.priya).toEqual({ name: 'Priya', beaten: 1, lost: 4 });
  });

  test('a night with nobody else leaves the map alone', () => {
    expect(meetRivals(NIGHT, 1_000, [])).toEqual(NIGHT);
    expect(meetRivals(undefined, 1_000, [])).toBeUndefined();
  });

  test('a tie against someone new writes nothing, and refreshes a name already there', () => {
    const rivals = meetRivals(NIGHT, 500, [
      { playerId: 'sam', name: 'Samuel', score: 500 },
      { playerId: 'alex', name: 'Alex', score: 500 },
    ]);

    expect(rivals?.sam).toEqual({ name: 'Samuel', beaten: 4, lost: 1 });
    expect(rivals?.alex).toBeUndefined();
  });

  test('drops an id that cannot be a map key, and your own id', () => {
    const rivals = meetRivals(undefined, 10, [
      { playerId: 'sam.work', name: 'Sam', score: 0 },
      { playerId: '', name: 'Nobody', score: 0 },
      { playerId: 'ok', name: '   ', score: 0 },
    ]);
    expect(rivals).toBeUndefined();
  });

  test('keeps the leader when the map is over the cap', () => {
    // One more opponent than the row will hold, and the leader is not first by id.
    const crowded: Record<string, Rival> = {
      zzz: { name: 'Leader', beaten: 5, lost: 0 },
    };
    for (let i = 0; i < RIVALS_CAP; i += 1) {
      crowded[`p${String(i).padStart(2, '0')}`] = { name: `Player ${i}`, beaten: 1, lost: 0 };
    }

    const rivals = meetRivals(crowded, 0, []);

    expect(rivals?.zzz).toEqual({ name: 'Leader', beaten: 5, lost: 0 });
    expect(Object.keys(rivals ?? {})).toHaveLength(RIVALS_CAP);
    expect(rivals?.[`p${String(RIVALS_CAP - 1).padStart(2, '0')}`]).toBeUndefined();
  });
});

describe('the rivals caption', () => {
  test('names who you have beaten most and who you have lost to most', () => {
    expect(rivalsCaption(NIGHT)).toBe(
      'You’ve beaten Sam most this season — 4 times, and lost to Priya most — 3 times.',
    );
  });

  // PROJ-80: "beaten Bert & cass & Greg & … most this season — once each" says nothing.
  test('says nothing about a lead of one', () => {
    expect(rivalsCaption({ sam: { name: 'Sam', beaten: 1, lost: 0 } })).toBeNull();
    expect(rivalsCaption({ priya: { name: 'Priya', beaten: 0, lost: 1 } })).toBeNull();
    expect(rivalsCaption({ sam: { name: 'Sam', beaten: 1, lost: 1 } })).toBeNull();
  });

  test('drops only the clause that says nothing', () => {
    expect(rivalsCaption({
      sam: { name: 'Sam', beaten: 3, lost: 0 },
      priya: { name: 'Priya', beaten: 0, lost: 1 },
    })).toBe('You’ve beaten Sam most this season — 3 times.');
    expect(rivalsCaption({
      sam: { name: 'Sam', beaten: 1, lost: 0 },
      priya: { name: 'Priya', beaten: 0, lost: 2 },
    })).toBe('You’ve lost to Priya most this season — 2 times.');
  });

  test('names a lead shared by three', () => {
    expect(rivalsCaption({
      sam: { name: 'Sam', beaten: 2, lost: 0 },
      alex: { name: 'Alex', beaten: 2, lost: 0 },
      jo: { name: 'Jo', beaten: 2, lost: 0 },
    })).toBe('You’ve beaten Alex & Jo & Sam most this season — 2 times each.');
  });

  test('says nothing about a lead shared by more than three', () => {
    const four = {
      sam: { name: 'Sam', beaten: 2, lost: 0 },
      alex: { name: 'Alex', beaten: 2, lost: 0 },
      jo: { name: 'Jo', beaten: 2, lost: 0 },
      kit: { name: 'Kit', beaten: 2, lost: 0 },
    };
    expect(rivalsCaption(four)).toBeNull();
    expect(rivalsCaption({ ...four, priya: { name: 'Priya', beaten: 0, lost: 4 } })).toBe(
      'You’ve lost to Priya most this season — 4 times.',
    );
  });

  test('names everyone tied for the lead', () => {
    expect(rivalsCaption({
      sam: { name: 'Sam', beaten: 4, lost: 0 },
      alex: { name: 'Alex', beaten: 4, lost: 0 },
    })).toBe('You’ve beaten Alex & Sam most this season — 4 times each.');

    expect(rivalsCaption({
      sam: { name: 'Sam', beaten: 0, lost: 2 },
      alex: { name: 'Alex', beaten: 0, lost: 2 },
    })).toBe('You’ve lost to Alex & Sam most this season — 2 times each.');
  });

  test('one person leading both lists is one sentence', () => {
    expect(rivalsCaption({ sam: { name: 'Sam', beaten: 3, lost: 3 } })).toBe(
      'You and Sam are level this season — 3 each.',
    );
    expect(rivalsCaption({ sam: { name: 'Sam', beaten: 4, lost: 2 } })).toBe(
      'You’ve beaten Sam most this season, and lost to Sam most — 4 and 2.',
    );
  });

  test('a shared lead on both lists names the pair once', () => {
    const level = {
      sam: { name: 'Sam', beaten: 3, lost: 3 },
      alex: { name: 'Alex', beaten: 3, lost: 3 },
    };
    expect(rivalsCaption(level)).toBe('Level with Alex & Sam this season — 3 each.');
  });

  test('says nothing when there is nobody to name', () => {
    expect(rivalsCaption(undefined)).toBeNull();
    expect(rivalsCaption({})).toBeNull();
    expect(rivalsCaption({ sam: { name: 'Sam', beaten: 0, lost: 0 } })).toBeNull();
  });

  test('does not follow map order', () => {
    const swapped: Record<string, Rival> = {
      priya: { name: 'Priya', beaten: 1, lost: 3 },
      sam: { name: 'Sam', beaten: 4, lost: 1 },
    };
    expect(rivalsCaption(swapped)).toBe(rivalsCaption(NIGHT));
  });
});

const BOTH: ReadonlySet<string> = new Set(['sam', 'priya']);

describe('nightAgainst', () => {
  const players = {
    greg: { name: 'Greg' },
    sam: { name: 'Sam' },
    priya: { name: 'Priya', playerId: 'priya-claimed' },
  };

  test('ranks an ordinary round on the scores just banked', () => {
    const night = nightAgainst('greg', players, { greg: 1_000, sam: 400, priya: 1_500 }, null, BOTH);

    expect(night.resultScore).toBe(1_000);
    expect(night.opponents).toEqual([
      { playerId: 'priya-claimed', name: 'Priya', score: 1_500 },
      { playerId: 'sam', name: 'Sam', score: 400 },
    ]);
  });

  test('ranks round two of a double on the morning, not the residual', () => {
    // Round two: Sam outscored Greg. The morning still has Greg ahead.
    const night = nightAgainst(
      'greg',
      players,
      { greg: 100, sam: 800, priya: 100 },
      { gameId: 'half', scores: { greg: 1_000, sam: 200, priya: 100 } },
      BOTH,
    );

    expect(night.resultScore).toBe(1_100);
    expect(night.opponents).toEqual([
      { playerId: 'priya-claimed', name: 'Priya', score: 200 },
      { playerId: 'sam', name: 'Sam', score: 1_000 },
    ]);
  });

  test('a player on their own has no opponents', () => {
    expect(nightAgainst('greg', { greg: { name: 'Greg' } }, { greg: 500 }, null, new Set()).opponents).toEqual([]);
  });

  // Joining seeds a score of 0, so a seat is not a game played. Room 6JA5 had
  // someone join eight seconds before the final screen (PROJ-64 review).
  test('someone who joined and never answered is nobody you beat', () => {
    const night = nightAgainst(
      'greg',
      { ...players, late: { name: 'Late' } },
      { greg: 1_000, sam: 400, priya: 1_500, late: 0 },
      null,
      BOTH,
    );

    expect(night.opponents.map((opponent) => opponent.playerId)).toEqual(['priya-claimed', 'sam']);
  });

  test('someone who answered and scored nothing is still someone you beat', () => {
    const night = nightAgainst(
      'greg',
      { ...players, late: { name: 'Late' } },
      { greg: 1_000, sam: 400, priya: 1_500, late: 0 },
      null,
      new Set(['sam', 'priya', 'late']),
    );

    expect(night.opponents.map((opponent) => opponent.playerId)).toEqual(['late', 'priya-claimed', 'sam']);
  });

  test('a morning score counts as having played, with no answer in round two', () => {
    const night = nightAgainst(
      'greg',
      players,
      { greg: 100, sam: 0, priya: 100 },
      { gameId: 'half', scores: { greg: 1_000, sam: 200, priya: 100 } },
      new Set(['priya']),
    );

    expect(night.opponents.map((opponent) => opponent.playerId)).toEqual(['priya-claimed', 'sam']);
  });
});

describe('answeredIn', () => {
  test('everyone with an answer on any question in the log', () => {
    expect(
      answeredIn([
        { answers: { greg: { optionIndex: 0, elapsedMs: 1 } } },
        { answers: { sam: { optionIndex: 1, elapsedMs: 1 } } },
        { answers: {} },
      ]),
    ).toEqual(new Set(['greg', 'sam']));
  });
});

describe('foldRivals', () => {
  test('adds the counts and keeps the name from the side that played last', () => {
    const merged = foldRivals(
      { sam: { name: 'Sammy', beaten: 2, lost: 0 } },
      { sam: { name: 'Sam', beaten: 4, lost: 1 } },
      false,
    );
    expect(merged).toEqual({ sam: { name: 'Sam', beaten: 6, lost: 1 } });
  });
});

describe('rivals on the season row', () => {
  test('banks the night onto the row and does not count the same game twice', () => {
    const first = bankGame(null, outcome({
      score: 2_000,
      resultScore: 2_000,
      opponents: [
        { playerId: 'sam', name: 'Sam', score: 1_000 },
        { playerId: 'priya', name: 'Priya', score: 3_000 },
      ],
    }));
    expect(first.rivals).toEqual({
      sam: { name: 'Sam', beaten: 1, lost: 0 },
      priya: { name: 'Priya', beaten: 0, lost: 1 },
    });

    const again = bankGame(first, outcome({
      gameId: 'game-2',
      opponents: [{ playerId: 'sam', name: 'Sam', score: 0 }],
    }));
    expect(again).toBe(first);
  });

  test('a caller from before the field does not clear a map already there', () => {
    const existing = record({ rivals: NIGHT });
    const banked = bankGame(existing, outcome());
    expect(banked.rivals).toEqual(NIGHT);
  });

  test('a claim adds the two maps together', () => {
    const merged = foldRecords(
      record({ rivals: { sam: { name: 'Sammy', beaten: 2, lost: 1 } }, lastPlayed: 2_000 }),
      record({ rivals: { sam: { name: 'Sam', beaten: 4, lost: 0 }, priya: { name: 'Priya', beaten: 0, lost: 3 } } }),
    );
    expect(merged.rivals).toEqual({
      sam: { name: 'Sammy', beaten: 6, lost: 1 },
      priya: { name: 'Priya', beaten: 0, lost: 3 },
    });
  });
});

describe('rivalsFrom', () => {
  test('drops an entry the caption could not say', () => {
    expect(rivalsFrom({
      sam: { name: 'Sam', beaten: 2, lost: 1 },
      bad: { name: '', beaten: 4, lost: 0 },
      worse: 'nope',
    })).toEqual({ sam: { name: 'Sam', beaten: 2, lost: 1 } });
  });
});
