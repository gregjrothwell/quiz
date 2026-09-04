import { describe, expect, test } from 'vitest';
import { planJoin, planSeatSquad } from './join';
import { resolveQuizmaster, type Player } from './state';

/** The room in 6JA5 as it stood when the mid-round join landed. */
const UNDER_WAY: Record<string, Player> = {
  greg: { name: 'Greg', joinedAt: 1_786_963_005_566 },
  amier: { name: 'Amier', joinedAt: 1_786_963_034_402 },
};

describe('planJoin', () => {
  test('starts a newcomer on zero mid-round', () => {
    // #given a round in progress and somebody arriving
    // #when they write themselves in
    const plan = planJoin({
      players: UNDER_WAY,
      scores: { greg: 4_675, amier: 3_786 },
      phase: 'question',
      uid: 'doubled',
      name: 'Double D',
      playerId: 'doubled',
      squad: '',
      restored: null,
      now: 1_786_963_245_823,
    });

    // #then they are on the board with nothing on it yet
    expect(plan.score).toBe(0);
    expect(plan.entry.name).toBe('Double D');
  });

  test('cannot take the chair with a timestamp earned elsewhere', () => {
    // #given a browser whose clock — or whose carried-over stamp from another
    // room — reads earlier than the host's join
    const plan = planJoin({
      players: UNDER_WAY,
      scores: {},
      phase: 'question',
      uid: 'doubled',
      name: 'Double D',
      playerId: 'doubled',
      squad: '',
      restored: null,
      now: 1_786_960_000_000,
    });

    // #when the room resolves its quizmaster with them in it
    const after = resolveQuizmaster({ ...UNDER_WAY, doubled: plan.entry });

    // #then the person running the quiz is still running it
    expect(after).toBe('greg');
  });

  test('gives a reaped player back the seat they held here', () => {
    // #given the quizmaster's entry has been reaped, but this device remembers
    // the place it held in this room
    const plan = planJoin({
      players: { amier: UNDER_WAY['amier'] as Player },
      scores: { greg: 4_675, amier: 3_786 },
      phase: 'question',
      uid: 'greg',
      name: 'Greg',
      playerId: 'greg',
      squad: '',
      restored: 1_786_963_005_566,
      now: 1_786_963_400_000,
    });

    // #then they come back ahead of whoever stayed put, and keep their score
    expect(plan.entry.joinedAt).toBe(1_786_963_005_566);
    expect(resolveQuizmaster({ ...UNDER_WAY, greg: plan.entry })).toBe('greg');
    expect(plan.score).toBe(4_675);
  });

  test('never restamps an entry that is still there', () => {
    // #given a player who is already listed
    const plan = planJoin({
      players: UNDER_WAY,
      scores: { greg: 4_675 },
      phase: 'reveal',
      uid: 'greg',
      name: 'Greg',
      playerId: 'greg',
      squad: '',
      restored: null,
      now: 1_786_963_400_000,
    });

    // #then their original place stands
    expect(plan.entry.joinedAt).toBe(1_786_963_005_566);
  });

  test('opens no score for somebody arriving after the round is over', () => {
    // #given a finished round and somebody walking in on the final screen —
    // Boss Man in 6JA5, eight seconds before the results went up
    const plan = planJoin({
      players: UNDER_WAY,
      scores: { greg: 4_675, amier: 3_786 },
      phase: 'finished',
      uid: 'bossman',
      name: 'Boss Man',
      playerId: 'bossman',
      squad: '',
      restored: null,
      now: 1_786_963_646_911,
    });

    // #then nothing goes on the board, so they are not on the podium or in the
    // loser's chair for a game they did not see
    expect(plan.score).toBeNull();
  });

  test('keeps a real score on a finished board', () => {
    // #given somebody who played the round and is rejoining the final screen
    const plan = planJoin({
      players: {},
      scores: { amier: 3_786 },
      phase: 'finished',
      uid: 'amier',
      name: 'Amier',
      playerId: 'amier',
      squad: '',
      restored: null,
      now: 1_786_963_646_911,
    });

    // #then their points are untouched
    expect(plan.score).toBe(3_786);
  });

  test('carries a claimed identity but not a redundant one', () => {
    // #given a browser playing under a claimed season record
    const claimed = planJoin({
      players: {},
      scores: {},
      phase: 'lobby',
      uid: 'device',
      name: 'Greg',
      playerId: 'season-greg',
      squad: '',
      restored: null,
      now: 1_000,
    });

    // #given a browser playing under its own uid
    const plain = planJoin({
      players: {},
      scores: {},
      phase: 'lobby',
      uid: 'device',
      name: 'Greg',
      playerId: 'device',
      squad: '',
      restored: null,
      now: 1_000,
    });

    // #then only the first states one
    expect(claimed.entry.playerId).toBe('season-greg');
    expect(Object.keys(plain.entry).sort()).toEqual(['joinedAt', 'name']);
  });
});

describe('the squad on the entry', () => {
  test('is written when there is one', () => {
    const plan = planJoin({
      players: {},
      scores: {},
      phase: 'lobby',
      uid: 'greg',
      name: 'Greg',
      playerId: 'greg',
      squad: 'Hermes',
      restored: null,
      now: 1,
    });

    expect(plan.entry.squad).toBe('Hermes');
  });

  test('is left off entirely for somebody who has never named one', () => {
    // Omitted rather than empty: an empty string would be a field on every
    // entry in every room saying nothing, and `playerOk` would have to accept
    // it. `squadStandings` reads absent and empty the same way.
    const plan = planJoin({
      players: {},
      scores: {},
      phase: 'lobby',
      uid: 'greg',
      name: 'Greg',
      playerId: 'greg',
      squad: '',
      restored: null,
      now: 1,
    });

    expect('squad' in plan.entry).toBe(false);
  });

  test('a rejoin never restamps it', () => {
    // #given somebody already seated with a squad, whose device now says
    // something else — a squad changed mid-round, or a second browser
    const players: Record<string, Player> = {
      greg: { name: 'Greg', joinedAt: 1, squad: 'Hermes' },
    };

    const plan = planJoin({
      players,
      scores: { greg: 900 },
      phase: 'question',
      uid: 'greg',
      name: 'Greg',
      playerId: 'greg',
      squad: 'Bundae',
      restored: null,
      now: 50,
    });

    // #then the seat is untouched, squad included — the same rule that stops a
    // reconnecting quizmaster losing the chair
    expect(plan.entry).toEqual(players.greg);
  });
});

describe('planSeatSquad', () => {
  const seated: Player = { name: 'Sam', joinedAt: 1_786_963_034_402 };

  test('writes a first pick onto a lobby seat that has none', () => {
    // #given a link-joiner already seated, with no squad on the entry
    // #when they pick a side in the lobby
    const plan = planSeatSquad({ existing: seated, phase: 'lobby', squad: 'Hermes' });

    // #then the write is the squad field only — joinedAt is not in the plan
    expect(plan).toEqual({ kind: 'set', squad: 'Hermes' });
  });

  test('lets them change their mind while the room is still a lobby', () => {
    const already: Player = { ...seated, squad: 'Hermes' };
    const plan = planSeatSquad({ existing: already, phase: 'lobby', squad: 'Bundae' });
    expect(plan).toEqual({ kind: 'set', squad: 'Bundae' });
  });

  test('clears a pick that is taken back before the show starts', () => {
    const already: Player = { ...seated, squad: 'Hermes' };
    const plan = planSeatSquad({ existing: already, phase: 'lobby', squad: '' });
    expect(plan).toEqual({ kind: 'clear' });
  });

  test('does nothing once the show has started', () => {
    // Frozen at join for the running total. A mid-round change is a storage
    // write for the bank, not a restamp of the board.
    const plan = planSeatSquad({
      existing: seated,
      phase: 'question',
      squad: 'Hermes',
    });
    expect(plan).toEqual({ kind: 'skip' });
  });

  test('does not mint a seat for somebody who is not in the room', () => {
    const plan = planSeatSquad({ existing: undefined, phase: 'lobby', squad: 'Hermes' });
    expect(plan).toEqual({ kind: 'skip' });
  });

  test('does not rewrite a squad that is already what they picked', () => {
    const already: Player = { ...seated, squad: 'Hermes' };
    const plan = planSeatSquad({ existing: already, phase: 'lobby', squad: 'Hermes' });
    expect(plan).toEqual({ kind: 'skip' });
  });

  test('a rejoin still cannot restamp joinedAt', () => {
    // The two paths stay apart: seating is planJoin, the squad field is this.
    const players: Record<string, Player> = { sam: seated };
    const seat = planJoin({
      players,
      scores: { sam: 0 },
      phase: 'lobby',
      uid: 'sam',
      name: 'Sam',
      playerId: 'sam',
      squad: 'Bundae',
      restored: null,
      now: 9_999,
    });
    const field = planSeatSquad({ existing: seated, phase: 'lobby', squad: 'Bundae' });

    expect(seat.entry.joinedAt).toBe(seated.joinedAt);
    expect(field).toEqual({ kind: 'set', squad: 'Bundae' });
    expect(resolveQuizmaster({ greg: UNDER_WAY.greg as Player, sam: seated })).toBe('greg');
  });
});
