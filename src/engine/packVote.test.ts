import { describe, expect, test } from 'vitest';
import {
  highlightFor,
  INITIAL_VOTE_GEN,
  leadingPacks,
  lobbyVotePath,
  mintsVoteGen,
  nextVote,
  readBrowsing,
  readLobbyVote,
  readPackVotes,
  readVoteTaps,
  tallyPackVotes,
  tapsLeft,
  VOTE_TAPS,
  voteGenOf,
} from './packVote';
import type { Player } from './state';

function seat(name: string, joinedAt: number): Player {
  return { name, joinedAt };
}

const ROOM: Record<string, Player> = {
  greg: seat('Greg', 1),
  sam: seat('Sam', 2),
  priya: seat('Priya', 3),
};

describe('readPackVotes', () => {
  test('keeps a vote for a real pack', () => {
    expect(readPackVotes({ sam: 'sleeves', priya: 'tunes' })).toEqual({
      sam: 'sleeves',
      priya: 'tunes',
    });
  });

  test('drops anything that is not a real pack, since any member can write the field', () => {
    // #given a map a member scribbled on
    const raw = { sam: 'sleeves', priya: 'not-a-pack', alex: 3, bo: null, cy: { id: 'tunes' } };

    // #then only the honest vote survives
    expect(readPackVotes(raw)).toEqual({ sam: 'sleeves' });
  });

  test('a room from before the vote has no field, and reads as nobody voting', () => {
    for (const raw of [undefined, null, 'sleeves', 7, ['sleeves']]) {
      expect(readPackVotes(raw)).toEqual({});
    }
  });
});

describe('readVoteTaps', () => {
  test('keeps the taps each player has used', () => {
    expect(readVoteTaps({ sam: 1, priya: 2 })).toEqual({ sam: 1, priya: 2 });
  });

  test('drops anything that is not a count, since any member can write the field', () => {
    // #given a map a member scribbled on
    const raw = { sam: 2, priya: -1, alex: 1.5, bo: '2', cy: null, di: Number.NaN };

    // #then only the honest count survives
    expect(readVoteTaps(raw)).toEqual({ sam: 2 });
  });

  test('a room from before the count has no field, and reads as nobody having tapped', () => {
    for (const raw of [undefined, null, 2, 'sam', [2]]) {
      expect(readVoteTaps(raw)).toEqual({});
    }
  });
});

describe('readBrowsing', () => {
  test('a real pack is kept, anything else is nothing highlighted', () => {
    expect(readBrowsing('screens')).toBe('screens');
    for (const raw of [undefined, null, '', 'not-a-pack', 4, {}]) {
      expect(readBrowsing(raw)).toBeNull();
    }
  });
});

describe('tallyPackVotes', () => {
  test('counts one per player', () => {
    const tally = tallyPackVotes({ greg: 'sleeves', sam: 'sleeves', priya: 'tunes' }, ROOM);
    expect(tally).toEqual({ sleeves: 2, tunes: 1 });
  });

  test('somebody who has left stops counting', () => {
    // #given a vote from a uid the reaper has already taken out of the room
    const tally = tallyPackVotes({ sam: 'sleeves', gone: 'sleeves', ghost: 'tunes' }, ROOM);

    // #then only the seat still in the room counts
    expect(tally).toEqual({ sleeves: 1 });
  });

  test('nobody voting is an empty tally', () => {
    expect(tallyPackVotes({}, ROOM)).toEqual({});
  });
});

describe('leadingPacks', () => {
  test('the pack with most votes leads', () => {
    expect(leadingPacks({ sleeves: 3, tunes: 1 })).toEqual(['sleeves']);
  });

  test('a tie leads together, and the quizmaster settles it', () => {
    expect(leadingPacks({ sleeves: 2, tunes: 2, flags: 1 }).sort()).toEqual(['sleeves', 'tunes']);
  });

  test('no votes means nothing leads', () => {
    expect(leadingPacks({})).toEqual([]);
  });
});

describe('nextVote', () => {
  test('a first tap casts the vote', () => {
    expect(nextVote(undefined, 'sleeves')).toBe('sleeves');
  });

  test('tapping another pack moves it', () => {
    expect(nextVote('sleeves', 'tunes')).toBe('tunes');
  });

  test('tapping your own again takes it back', () => {
    expect(nextVote('sleeves', 'sleeves')).toBeNull();
  });
});

describe('tapsLeft', () => {
  test('two taps: cast, then change your mind once', () => {
    expect(VOTE_TAPS).toBe(2);
    expect(tapsLeft(0)).toBe(2);
    expect(tapsLeft(1)).toBe(1);
  });

  test('spent is spent, however many taps were counted', () => {
    expect(tapsLeft(2)).toBe(0);
    expect(tapsLeft(7)).toBe(0);
  });
});

describe('voteGenOf', () => {
  test('a short id is the generation the room is reading', () => {
    expect(voteGenOf('gen-1')).toBe('gen-1');
    expect(voteGenOf('550e8400-e29b-41d4-a716-446655440000')).toHaveLength(36);
  });

  test('anything else is the initial generation, including a room that has none', () => {
    for (const raw of [undefined, null, '', 'has spaces', 'x'.repeat(41), 1, {}]) {
      expect(voteGenOf(raw)).toBe(INITIAL_VOTE_GEN);
    }
  });
});

describe('readLobbyVote', () => {
  test('reads one generation, and the path it was read from', () => {
    expect(lobbyVotePath('ABCD', 'gen-1')).toBe('lobbyVote/ABCD/gen-1');
    expect(
      readLobbyVote({
        packVotes: { sam: 'sleeves', priya: 'not-a-pack' },
        voteTaps: { sam: 1, priya: -1 },
        browsing: { host: 'flags', sam: 'nope' },
      }),
    ).toEqual({
      packVotes: { sam: 'sleeves' },
      voteTaps: { sam: 1 },
      browsingBy: { host: 'flags' },
    });
  });

  test('an empty generation, and a missing one, is nobody voting', () => {
    const empty = { packVotes: {}, voteTaps: {}, browsingBy: {} };
    for (const raw of [undefined, null, 'sleeves', []]) {
      expect(readLobbyVote(raw)).toEqual(empty);
    }
  });
});

describe('highlightFor', () => {
  test('the room is shown the host slot, not another player writing their own', () => {
    const browsingBy = { host: 'flags' as const, guest: 'sleeves' as const };
    expect(highlightFor(browsingBy, 'host')).toBe('flags');
    expect(highlightFor(browsingBy, 'guest')).toBe('sleeves');
    expect(highlightFor(browsingBy, 'absent')).toBeNull();
    expect(highlightFor(browsingBy, null)).toBeNull();
  });
});

describe('mintsVoteGen', () => {
  test('a dispatch inside the lobby keeps the generation the votes were cast on', () => {
    // `selectPack` and the opening titles both dispatch in the lobby; minting
    // a new id would throw away a vote cast a moment ago.
    expect(mintsVoteGen('lobby', 'lobby')).toBe(false);
  });

  test('starting a round mints one, which is how the vote clears', () => {
    expect(mintsVoteGen('lobby', 'question')).toBe(true);
  });

  test('a reset back to the lobby mints one, so the next lobby starts empty', () => {
    expect(mintsVoteGen('finished', 'lobby')).toBe(true);
    expect(mintsVoteGen('scoreboard', 'lobby')).toBe(true);
  });

  test('mid-round transitions never mint one', () => {
    expect(mintsVoteGen('question', 'reveal')).toBe(false);
    expect(mintsVoteGen('reveal', 'scoreboard')).toBe(false);
  });

  test('with no earlier snapshot there is nothing to cross', () => {
    expect(mintsVoteGen(null, 'lobby')).toBe(false);
  });
});
