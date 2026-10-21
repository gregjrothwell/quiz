import { describe, expect, test } from 'vitest';
import { boardMoves } from './movement';

const PLAYERS = { greg: {}, sam: {}, priya: {}, alex: {} };

describe('boardMoves', () => {
  test('says nothing without a question behind it', () => {
    // #given a board with no deltas, as the final screen shows it
    // #then nobody moved and nobody took the lead
    expect(boardMoves(PLAYERS, { greg: 3_000, sam: 2_000 }, {})).toEqual({ moves: {}, newLeader: null });
  });

  test('counts places climbed and dropped, and leaves the unmoved out', () => {
    // #given Sam overtaking Greg and Priya on the last question
    const before = { greg: 3_000, priya: 2_500, sam: 2_000, alex: 500 };
    const deltas = { sam: 1_200, greg: 0, priya: 0, alex: 0 };
    const scores = { ...before, sam: 3_200 };

    // #when the board is read
    const { moves, newLeader } = boardMoves(PLAYERS, scores, deltas);

    // #then Sam is up two, the two he passed are down one, and Alex is untouched
    expect(moves).toEqual({ sam: 2, greg: -1, priya: -1 });
    // #and Sam leads alone, which he did not before
    expect(newLeader).toBe('sam');
  });

  test('a leader who stays ahead is not a new leader', () => {
    const deltas = { greg: 500, sam: 900 };
    const scores = { greg: 3_500, sam: 2_900 };
    expect(boardMoves({ greg: {}, sam: {} }, scores, deltas).newLeader).toBeNull();
  });

  test('pulling level with the leader is not taking the lead', () => {
    // #given Sam catching Greg exactly
    const scores = { greg: 3_000, sam: 3_000 };
    const deltas = { greg: 0, sam: 1_000 };

    // #then joint first is nobody's new lead, and Sam moved up into the tie
    expect(boardMoves({ greg: {}, sam: {} }, scores, deltas)).toEqual({ moves: { sam: 1 }, newLeader: null });
  });

  test('the first question crowns whoever pulls clear of a level start', () => {
    // #given everyone on nothing before question one
    const scores = { greg: 0, sam: 1_000, priya: 0 };
    const deltas = { greg: 0, sam: 1_000, priya: 0 };

    // #then Sam leads alone, and the joint-first he came from is no lead at all
    expect(boardMoves({ greg: {}, sam: {}, priya: {} }, scores, deltas).newLeader).toBe('sam');
  });

  test('a fall works back from a negative delta, as a lost stake or a shaft pays out', () => {
    // #given Greg losing his whole score in the final, and third place inheriting the lead
    const scores = { greg: 0, sam: 0, priya: 1_800 };
    const deltas = { greg: -3_100, sam: -2_450 };

    // #then Priya is the new leader, two places up
    const { moves, newLeader } = boardMoves({ greg: {}, sam: {}, priya: {} }, scores, deltas);
    expect(newLeader).toBe('priya');
    expect(moves.priya).toBe(2);
  });

  test('somebody who has left the room is not on either board', () => {
    const scores = { greg: 3_000, gone: 9_000 };
    const deltas = { greg: 1_000, gone: 0 };
    expect(boardMoves({ greg: {} }, scores, deltas).moves).toEqual({});
  });
});
