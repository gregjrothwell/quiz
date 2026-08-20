import { describe, expect, test } from 'vitest';
import {
  BASE_POINTS,
  RANK_BONUSES,
  RANK_FLOOR,
  rankBonus,
  roomStandings,
  seatedLast,
  standings,
  tallyQuestion,
  verdictFor,
} from './scoring';

/** Whichever lectern the vault named when the question closed. */
const correctIndex = 1;

describe('rankBonus', () => {
  test('pays the ladder down to fourth', () => {
    // #given the first four positions
    const positions = [1, 2, 3, 4];

    // #when each is paid
    const bonuses = positions.map(rankBonus);

    // #then they take the ladder as published
    expect(bonuses).toEqual([...RANK_BONUSES]);
  });

  test('pays the floor from fifth onwards', () => {
    // #given positions past the end of the ladder
    const positions = [5, 6, 20];

    // #when each is paid
    const bonuses = positions.map(rankBonus);

    // #then every one of them is on the floor rather than tailing to nothing
    expect(bonuses).toEqual([RANK_FLOOR, RANK_FLOOR, RANK_FLOOR]);
  });

  test('treats a position before first as first', () => {
    // #given a position that should not exist
    // #when it is paid
    // #then it cannot pay more than the top of the ladder
    expect(rankBonus(0)).toBe(RANK_BONUSES[0]);
  });
});

describe('tallyQuestion', () => {
  test('pays the ladder by the order the correct answers landed', () => {
    // #given four correct answers at different speeds, in no particular key order
    const answers = {
      third: { optionIndex: 1, elapsedMs: 4_000 },
      first: { optionIndex: 1, elapsedMs: 900 },
      fourth: { optionIndex: 1, elapsedMs: 8_100 },
      second: { optionIndex: 1, elapsedMs: 2_500 },
    };

    // #when the question is tallied
    const deltas = tallyQuestion({ correctIndex, answers });

    // #then each takes base plus its rank bonus
    expect(deltas).toEqual({ first: 1000, second: 900, third: 800, fourth: 700 });
  });

  test('puts the fifth correct answer and everyone after it on the floor', () => {
    // #given six people who all got it right
    const answers = Object.fromEntries(
      ['a', 'b', 'c', 'd', 'e', 'f'].map((uid, i) => [
        uid,
        { optionIndex: 1, elapsedMs: (i + 1) * 1_000 },
      ]),
    );

    // #when the question is tallied
    const deltas = tallyQuestion({ correctIndex, answers });

    // #then the last two are level on the floor rather than tailing to nothing
    expect(deltas).toEqual({ a: 1000, b: 900, c: 800, d: 700, e: 600, f: 600 });
  });

  test('ranks only the correct answers, ignoring faster wrong ones', () => {
    // #given the two fastest answers of the question being wrong
    const answers = {
      quick: { optionIndex: 0, elapsedMs: 100 },
      quicker: { optionIndex: 3, elapsedMs: 50 },
      right: { optionIndex: 1, elapsedMs: 6_000 },
    };

    // #when the question is tallied
    const deltas = tallyQuestion({ correctIndex, answers });

    // #then being first of the people who got it right is first
    expect(deltas).toEqual({ quick: 0, quicker: 0, right: 1000 });
  });

  test('records a wrong answer as a zero rather than omitting it', () => {
    // #given a fast correct answer and a slow wrong one
    const answers = {
      fast: { optionIndex: 1, elapsedMs: 0 },
      slow: { optionIndex: 0, elapsedMs: 10_000 },
    };

    // #when the question is tallied
    const deltas = tallyQuestion({ correctIndex, answers });

    // #then the wrong answer is present on zero. `verdictFor` reads the absence
    // of a key as `lost`, so omitting it would tell an honest wrong answer that
    // the room never scored it.
    expect(deltas).toEqual({ fast: 1000, slow: 0 });
  });

  test('gives a question nobody got right a zero for everybody who tried', () => {
    // #given three wrong answers and no right one
    const answers = {
      a: { optionIndex: 0, elapsedMs: 1_000 },
      b: { optionIndex: 2, elapsedMs: 2_000 },
      c: { optionIndex: 3, elapsedMs: 3_000 },
    };

    // #when the question is tallied
    const deltas = tallyQuestion({ correctIndex, answers });

    // #then nobody scores and nobody is missing
    expect(deltas).toEqual({ a: 0, b: 0, c: 0 });
  });

  test('shares a rank on a tie and resumes at the count already awarded', () => {
    // #given two players level on the fastest correct answer
    const answers = {
      dead: { optionIndex: 1, elapsedMs: 1_500 },
      heat: { optionIndex: 1, elapsedMs: 1_500 },
      after: { optionIndex: 1, elapsedMs: 3_000 },
    };

    // #when the question is tallied
    const deltas = tallyQuestion({ correctIndex, answers });

    // #then both are first and the next is third — the convention `standings`
    // already uses, so the game has one tie rule rather than two
    expect(deltas).toEqual({ dead: 1000, heat: 1000, after: 800 });
  });

  test('does not care how long the window was', () => {
    // #given the same single correct answer landing late in a long question
    const answers = { only: { optionIndex: 1, elapsedMs: 19_000 } };

    // #when the question is tallied
    const deltas = tallyQuestion({ correctIndex, answers });

    // #then it still takes first, because the ladder ranks answers against each
    // other rather than against the clock. This is the whole change: under the
    // old curve the same answer scored 525.
    expect(deltas).toEqual({ only: BASE_POINTS + RANK_BONUSES[0] });
  });

  test('sorts a negative elapsed time to the front rather than breaking', () => {
    // #given a clock skew producing a negative reading
    const answers = {
      skewed: { optionIndex: 1, elapsedMs: -5_000 },
      honest: { optionIndex: 1, elapsedMs: 1_000 },
    };

    // #when the question is tallied
    const deltas = tallyQuestion({ correctIndex, answers });

    // #then it ranks first, which is what the old curve's clamp did too
    expect(deltas).toEqual({ skewed: 1000, honest: 900 });
  });

  test('omits players who did not answer', () => {
    // #given nobody answered
    const answers = {};

    // #when the question is tallied
    const deltas = tallyQuestion({ correctIndex, answers });

    // #then the result is empty, distinguishing silence from a wrong answer
    expect(deltas).toEqual({});
  });
});

describe('standings', () => {
  test('ranks players by score, highest first', () => {
    // #given three distinct scores
    const scores = { alice: 500, bob: 1500, carol: 1000 };

    // #when standings are computed
    const result = standings(scores);

    // #then they are ordered high to low
    expect(result.map((entry) => entry.uid)).toEqual(['bob', 'carol', 'alice']);
  });

  test('gives tied players the same position and skips the next', () => {
    // #given two players tied at the top
    const scores = { alice: 1000, bob: 1000, carol: 500 };

    // #when standings are computed
    const result = standings(scores);

    // #then both are first and the next player is third
    expect(result.map((entry) => entry.position)).toEqual([1, 1, 3]);
  });

  test('returns nothing when no one has a score', () => {
    // #given an empty score table
    const scores = {};

    // #when standings are computed
    const result = standings(scores);

    // #then there are no standings
    expect(result).toEqual([]);
  });
});

describe('roomStandings', () => {
  test('drops anybody the room no longer lists', () => {
    // `scores` outlives membership, so the leaver is still in the map.
    const scores = { greg: 3000, nadia: 2000, gone: 5000 };
    const players = { greg: {}, nadia: {} };

    expect(roomStandings(players, scores).map((entry) => entry.uid)).toEqual(['greg', 'nadia']);
  });

  test('positions are inherited from the full table, not re-derived', () => {
    // Ranking happens before the filter, so a departed leader leaves a gap: the
    // top row of the returned table is position 2, and nobody holds position 1.
    //
    // Asserted rather than corrected. This is the behaviour all three call sites
    // already had — the filter was written out three times identically — and
    // this change only moved it. It matters because `recordGame` banks a win on
    // `position === 1`, so in this state nobody is credited with the win rather
    // than the wrong person being credited, which is the safer of the two.
    //
    // Rarely reached in practice: the final screen ranks the frozen snapshot, in
    // which the leaver is still a member and so is not filtered out at all. See
    // docs/decisions/season.md.
    const scores = { greg: 3000, nadia: 2000, gone: 5000 };
    const rows = roomStandings({ greg: {}, nadia: {} }, scores);

    expect(rows[0]).toEqual({ uid: 'greg', score: 3000, position: 2 });
    expect(rows.some((entry) => entry.position === 1)).toBe(false);
  });

  test('a room with nobody in it ranks nobody', () => {
    expect(roomStandings({}, { greg: 3000 })).toEqual([]);
  });
});

describe('seatedLast', () => {
  test('seats the one player below the podium', () => {
    // #given a four-player round with a clear bottom
    const scores = { alice: 1000, bob: 900, carol: 800, dave: 100 };

    // #when the chair is filled
    const seated = seatedLast(standings(scores));

    // #then it is whoever finished last
    expect(seated).toEqual(['dave']);
  });

  test('sits a tie for last down together', () => {
    // #given two players level on the bottom score
    const scores = { alice: 1000, bob: 900, carol: 800, dave: 100, erin: 100 };

    // #when the chair is filled
    const seated = seatedLast(standings(scores));

    // #then both of them are in it, because a shared last is still last
    expect(new Set(seated)).toEqual(new Set(['dave', 'erin']));
  });

  test('seats nobody when the whole room finished level', () => {
    // #given a round nobody scored in
    const scores = { alice: 0, bob: 0, carol: 0, dave: 0 };

    // #when the chair is filled
    const seated = seatedLast(standings(scores));

    // #then there is no loser to seat
    expect(seated).toEqual([]);
  });

  test('seats nobody in a room of three, who are all on the podium', () => {
    // #given a round small enough that last place is already on a riser
    const scores = { alice: 1000, bob: 900, carol: 800 };

    // #when the chair is filled
    const seated = seatedLast(standings(scores));

    // #then nobody stands on a riser and sits in the chair at once
    expect(seated).toEqual([]);
  });

  test('seats nobody when the tie for last reaches into the podium', () => {
    // #given third, fourth and fifth all level, so the tie starts on the podium
    const scores = { alice: 1000, bob: 900, carol: 100, dave: 100, erin: 100 };

    // #when the chair is filled
    const seated = seatedLast(standings(scores));

    // #then the chair stays empty rather than seating somebody already stood up
    expect(seated).toEqual([]);
  });

  test('seats nobody in an empty room', () => {
    // #given no standings at all
    const rows = standings({});

    // #when the chair is filled
    const seated = seatedLast(rows);

    // #then there is nothing to seat
    expect(seated).toEqual([]);
  });
});

describe('verdictFor', () => {
  test('names a correct answer', () => {
    // #given an answer on the right lectern, scored by the reveal
    const verdict = verdictFor({
      answer: { optionIndex: 1, elapsedMs: 2_000 },
      correctIndex: 1,
      deltas: { amier: 1000 },
      uid: 'amier',
    });

    // #then it is correct
    expect(verdict).toBe('correct');
  });

  test('names a wrong answer, which the tally still records', () => {
    // #given an answer on the wrong lectern — present in the deltas as a zero
    const verdict = verdictFor({
      answer: { optionIndex: 3, elapsedMs: 2_000 },
      correctIndex: 1,
      deltas: { amier: 0 },
      uid: 'amier',
    });

    // #then it is wrong rather than lost
    expect(verdict).toBe('wrong');
  });

  test('calls an answer lost when the tally never saw it', () => {
    // #given a correct answer that landed while the vault was being asked, so
    // the reveal was folded without it
    const verdict = verdictFor({
      answer: { optionIndex: 1, elapsedMs: 14_900 },
      correctIndex: 1,
      deltas: { greg: 1000, friar: 0 },
      uid: 'amier',
    });

    // #then the player is told, rather than shown "Correct · +0"
    expect(verdict).toBe('lost');
  });

  test('does not call silence a lost answer', () => {
    // #given a player who never answered at all
    const verdict = verdictFor({
      answer: undefined,
      correctIndex: 1,
      deltas: { greg: 1000 },
      uid: 'amier',
    });

    // #then nothing went wrong — they just did not answer
    expect(verdict).toBe('silent');
  });

  test('reads a question nobody answered as silence, not loss', () => {
    // #given a reveal where the whole room ran out of time
    const verdict = verdictFor({
      answer: undefined,
      correctIndex: 1,
      deltas: {},
      uid: 'amier',
    });

    // #then no alarm is raised
    expect(verdict).toBe('silent');
  });

  test('agrees with the tally it is reading', () => {
    // #given the answers the reveal actually scored
    const answers = {
      greg: { optionIndex: 1, elapsedMs: 4_510 },
      amier: { optionIndex: 2, elapsedMs: 12_203 },
    };
    const deltas = tallyQuestion({ correctIndex: 1, answers });

    // #when a third player's answer arrives too late to be in it
    const late = { optionIndex: 1, elapsedMs: 14_900 };

    // #then the two scored players read as scored and the third as lost
    expect([
      verdictFor({ answer: answers.greg, correctIndex: 1, deltas, uid: 'greg' }),
      verdictFor({ answer: answers.amier, correctIndex: 1, deltas, uid: 'amier' }),
      verdictFor({ answer: late, correctIndex: 1, deltas, uid: 'friar' }),
    ]).toEqual(['correct', 'wrong', 'lost']);
  });
});
