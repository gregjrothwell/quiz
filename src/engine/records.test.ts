import { describe, expect, test } from 'vitest';
import { foldRecords, type PlayerRecord } from './records';

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
  test('carries a team through the fold', () => {
    // #given a record joining one that already sits in a league
    const source = record();
    const target = record({ team: 'Engineering' });

    // #when they are folded together
    const merged = foldRecords(source, target);

    // #then the league survives. Both writers use `set`, a whole-document
    // overwrite, so a field dropped here is erased by the next game played
    expect(merged.team).toBe('Engineering');
  });

  test('omits the team entirely when neither side has one', () => {
    // #given two records from before leagues existed
    // #when they are folded together
    const merged = foldRecords(record(), record());

    // #then the key is absent rather than explicitly undefined, which Firestore
    // rejects outright
    expect('team' in merged).toBe(false);
  });
});
