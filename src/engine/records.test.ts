import { describe, expect, test } from 'vitest';
import { bankGame, foldRecords, type GameOutcome, type PlayerRecord } from './records';

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

describe('bankGame', () => {
  test('opens a record for the first game in a bucket', () => {
    // #given nothing banked yet, which is every player's first Monday of a new
    // week as well as their first ever game
    // #when a game is banked
    const banked = bankGame(null, outcome({ score: 2_450, won: true }));

    // #then the record starts from that one game rather than from zero plus it
    expect(banked.played).toBe(1);
    expect(banked.wins).toBe(1);
    expect(banked.points).toBe(2_450);
    expect(banked.best).toBe(2_450);
    expect(banked.lastGame).toBe('game-2');
  });

  test('accumulates onto a record that already has games in it', () => {
    // #given a record with three games on it
    const existing = record({ played: 3, wins: 1, points: 6_000, best: 2_400 });

    // #when a fourth is banked
    const banked = bankGame(existing, outcome({ score: 1_800 }));

    // #then the totals move and the personal best does not, because 1,800 is
    // not better than 2,400
    expect(banked.played).toBe(4);
    expect(banked.points).toBe(7_800);
    expect(banked.best).toBe(2_400);
  });

  test('raises the personal best when the night beats it', () => {
    // #given a record whose best is 2,400
    const existing = record({ played: 3, points: 6_000, best: 2_400 });

    // #when a better game is banked
    const banked = bankGame(existing, outcome({ score: 3_100 }));

    // #then the best is the new score, not the sum of the two
    expect(banked.best).toBe(3_100);
  });

  test('counts a rosette onto the shelf', () => {
    // #given a record already carrying one fastest finger
    const existing = record({ played: 2, points: 4_000, fastest: 1 });

    // #when a night carrying two more rosettes is banked
    const banked = bankGame(existing, outcome({
      honours: { fastest: 1, comeback: 0, loneWolf: 1, contrarian: 0 },
    }));

    // #then each is counted on its own, and an absent one stays at zero
    expect(banked.fastest).toBe(2);
    expect(banked.loneWolf).toBe(1);
    expect(banked.comeback).toBe(0);
  });

  test('an empty squad keeps the one the record already had', () => {
    // #given a record set to a squad on some other device
    const existing = record({ team: 'Hermes' });

    // #when a browser that knows of no squad banks a game
    const banked = bankGame(existing, outcome({ squad: '' }));

    // #then the squad survives. Without this, playing one game from a phone
    // would silently wipe the squad set on a laptop. Read back as `team`,
    // which is what the field is called in Firestore
    expect(banked.team).toBe('Hermes');
  });

  test('a stated squad overwrites the one on the record', () => {
    // #given a record on one squad
    const existing = record({ team: 'Hermes' });

    // #when a game is banked naming another
    const banked = bankGame(existing, outcome({ squad: 'Bundae' }));

    // #then the stated one wins — this is the deliberate edit path
    expect(banked.team).toBe('Bundae');
  });

  test('leaves the stored team field off entirely when there is none', () => {
    // #given no squad on either side
    // #when a game is banked
    const banked = bankGame(null, outcome({ squad: '' }));

    // #then the key is absent rather than undefined, which Firestore rejects
    // outright — the same reason foldRecords spreads it conditionally
    expect('team' in banked).toBe(false);
  });

  test('writes a record the rules would accept', () => {
    // #given a long-running record and a winning night with every rosette
    const existing = record({ played: 40, wins: 12, points: 90_000, best: 3_400 });
    const banked = bankGame(existing, outcome({
      score: 3_600,
      won: true,
      honours: { fastest: 1, comeback: 1, loneWolf: 1, contrarian: 1 },
    }));

    // #then every bound firestore.rules imposes still holds, so banking can
    // never write a row the rules would then refuse
    expect(banked.wins).toBeLessThanOrEqual(banked.played);
    expect(banked.best).toBeLessThanOrEqual(banked.points);
    expect(banked.fastest ?? 0).toBeLessThanOrEqual(banked.played);
    expect(banked.comeback ?? 0).toBeLessThanOrEqual(banked.played);
    expect(banked.loneWolf ?? 0).toBeLessThanOrEqual(banked.played);
    expect(banked.contrarian ?? 0).toBeLessThanOrEqual(banked.played);
  });

  test('a fresh week bucket satisfies best <= points on its very first game', () => {
    // #given an empty bucket, which is what every Monday looks like
    // #when the first game of the week is banked
    const banked = bankGame(null, outcome({ score: 3_100 }));

    // #then best equals points rather than exceeding them. This is the bound
    // most likely to be tripped by a second bucket, because a week's total
    // starts at one game rather than at a season's worth
    expect(banked.best).toBe(banked.points);
    expect(banked.best).toBeLessThanOrEqual(banked.points);
  });

  test('a lost floor can put the season total below zero', () => {
    const existing = record({ played: 3, points: 0, best: 0 });
    const banked = bankGame(existing, outcome({ score: -500 }));
    expect(banked.points).toBe(-500);
    // best is a maximum against a zero floor, so it stays put
    expect(banked.best).toBe(0);
  });

  test('best can sit above a negative total', () => {
    // The case that made `best <= points` wrong: one good night, then a floor
    // lost from nothing.
    const existing = record({ played: 1, points: 1_000, best: 1_000 });
    const banked = bankGame(existing, outcome({ score: -500 }));
    expect(banked.points).toBe(500);
    expect(banked.best).toBe(1_000);
    expect(banked.best).toBeGreaterThan(banked.points);
  });
});

describe('foldRecords', () => {
  test('sums the totals and keeps the better personal best', () => {
    // #given a browser's own record and the one it is claiming
    const source = record({ played: 3, wins: 1, points: 5_000, best: 2_400 });
    const target = record({ played: 10, wins: 4, points: 19_000, best: 3_100 });

    // #when they are folded together
    const merged = foldRecords(source, target);

    // #then the totals add up and the best is the better of the two, not their
    // sum — a personal best is not improved by having been set twice
    expect(merged.played).toBe(13);
    expect(merged.wins).toBe(5);
    expect(merged.points).toBe(24_000);
    expect(merged.best).toBe(3_100);
  });

  test('sums the rosettes, treating an absent count as none', () => {
    // #given a record from before honours existed and one with a shelf
    const source = record({ played: 2, fastest: 1, contrarian: 2 });
    const target = record({ played: 5 });

    // #when they are folded together
    const merged = foldRecords(source, target);

    // #then the missing counts read as zero rather than breaking the sum
    expect(merged.fastest).toBe(1);
    expect(merged.contrarian).toBe(2);
    expect(merged.comeback).toBe(0);
  });

  test('takes the name of the identity being adopted', () => {
    // #given a browser called "Greg (work)" claiming a record called "Greg"
    const source = record({ name: 'Greg (work)' });
    const target = record({ name: 'Greg' });

    // #when they are folded together
    const merged = foldRecords(source, target);

    // #then the board keeps the name it already showed
    expect(merged.name).toBe('Greg');
  });

  test('keeps the incoming name when there is no record to join', () => {
    // #given a code minted before its owner had ever finished a round
    const source = record({ name: 'Greg (work)' });

    // #when it is folded into nothing
    const merged = foldRecords(source, null);

    // #then the record is created under the only name available
    expect(merged.name).toBe('Greg (work)');
    expect(merged.played).toBe(1);
  });

  test('carries the most recent game forward, whichever side played it', () => {
    // #given a browser that has just finished a round, claiming an older record
    const source = record({ lastGame: 'tonight', lastPlayed: 9_000 });
    const target = record({ lastGame: 'last-week', lastPlayed: 2_000 });

    // #when they are folded together
    const merged = foldRecords(source, target);

    // #then tonight's game id survives — it is the guard that stops a reload of
    // the final screen banking that round a second time
    expect(merged.lastGame).toBe('tonight');
  });

  test('keeps the target’s game when the target played more recently', () => {
    // #given a stale browser claiming a record that has been played since
    const source = record({ lastGame: 'ages-ago', lastPlayed: 1_000 });
    const target = record({ lastGame: 'yesterday', lastPlayed: 8_000 });

    // #when they are folded together
    const merged = foldRecords(source, target);

    // #then the guard describes the game that could actually be re-banked
    expect(merged.lastGame).toBe('yesterday');
  });

  test('cannot produce a record the security rules would refuse', () => {
    // #given two records each satisfying the rules' own invariants
    const source = record({ played: 4, wins: 4, points: 8_000, best: 3_000, fastest: 4 });
    const target = record({ played: 6, wins: 6, points: 9_000, best: 2_000, fastest: 6 });

    // #when they are folded together
    const merged = foldRecords(source, target);

    // #then wins <= played, best <= points and each honour <= played still hold,
    // so a merge can never write a row the rules would then reject
    expect(merged.wins).toBeLessThanOrEqual(merged.played);
    expect(merged.best).toBeLessThanOrEqual(merged.points);
    expect(merged.fastest ?? 0).toBeLessThanOrEqual(merged.played);
  });
});

describe('foldRecords and the fields it does not own', () => {
  test('carries a squad through the fold', () => {
    // #given a record joining one that already sits in a league
    const source = record();
    const target = record({ team: 'Engineering' });

    // #when they are folded together
    const merged = foldRecords(source, target);

    // #then the league survives. Both writers use `set`, a whole-document
    // overwrite, so a field dropped here is erased by the next game played
    expect(merged.team).toBe('Engineering');
  });

  test('omits the stored team field entirely when neither side has one', () => {
    // #given two records from before leagues existed
    // #when they are folded together
    const merged = foldRecords(record(), record());

    // #then the key is absent rather than explicitly undefined, which Firestore
    // rejects outright
    expect('team' in merged).toBe(false);
  });
});
