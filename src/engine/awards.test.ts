import { describe, expect, test } from 'vitest';
import { awardsFor, reviewFor, type Award, type QuestionRecord } from './awards';
import type { Answer } from './state';

function answer(optionIndex: number, elapsedMs: number): Answer {
  return { optionIndex, elapsedMs };
}

function record(
  index: number,
  correctIndex: number,
  answers: Record<string, Answer>,
  deltas: Record<string, number> = {},
): QuestionRecord {
  return { index, correctIndex, answers, deltas };
}

function find<T extends Award['id']>(awards: Award[], id: T): Extract<Award, { id: T }> | undefined {
  return awards.find((award) => award.id === id) as Extract<Award, { id: T }> | undefined;
}

const PLAYERS = ['alex', 'greg', 'priya', 'sam'];

describe('fastest finger', () => {
  test('picks the quickest correct answer of the game', () => {
    // #given two correct answers on different questions
    const log = [
      record(0, 0, { greg: answer(0, 4_000), sam: answer(1, 1_000) }),
      record(1, 1, { greg: answer(1, 2_500), sam: answer(0, 900) }),
    ];

    // #when the awards are worked out
    const award = find(awardsFor(log, PLAYERS), 'fastest');

    // #then the quickest *correct* one wins, not the quickest overall — Sam's
    // 900ms was wrong
    expect(award).toEqual({ id: 'fastest', uids: ['greg'], elapsedMs: 2_500 });
  });

  test('shares the award on an exact tie', () => {
    // #given two players correct on the same millisecond
    const log = [record(0, 0, { sam: answer(0, 1_500), alex: answer(0, 1_500) })];

    // #when the awards are worked out
    const award = find(awardsFor(log, PLAYERS), 'fastest');

    // #then both are named, in a stable order
    expect(award?.uids).toEqual(['alex', 'sam']);
  });

  test('is not awarded when nobody was ever right', () => {
    // #given a round the room comprehensively lost
    const log = [record(0, 0, { greg: answer(1, 1_000), sam: answer(2, 2_000) })];

    // #when the awards are worked out
    const award = find(awardsFor(log, PLAYERS), 'fastest');

    // #then there is no fastest finger rather than one invented from the wrong
    // answers
    expect(award).toBeUndefined();
  });
});

describe('lone wolf', () => {
  test('counts questions the winner got and nobody else did', () => {
    // #given two questions only Priya got, and one that two people got
    const log = [
      record(0, 0, { priya: answer(0, 3_000), greg: answer(1, 2_000) }),
      record(1, 2, { priya: answer(2, 3_000), greg: answer(0, 2_000) }),
      record(2, 1, { priya: answer(1, 3_000), greg: answer(1, 2_000) }),
    ];

    // #when the awards are worked out
    const award = find(awardsFor(log, PLAYERS), 'lone-wolf');

    // #then the shared question does not count towards it
    expect(award).toEqual({ id: 'lone-wolf', uids: ['priya'], count: 2 });
  });

  test('is not awarded when every right answer was shared', () => {
    // #given a question two people got
    const log = [record(0, 0, { priya: answer(0, 3_000), greg: answer(0, 2_000) })];

    // #when the awards are worked out
    const award = find(awardsFor(log, PLAYERS), 'lone-wolf');

    // #then nobody was ever alone in being right
    expect(award).toBeUndefined();
  });
});

describe('contrarian', () => {
  test('counts wrong answers nobody else picked', () => {
    // #given Alex wrong on their own, and Greg wrong with company
    const log = [
      record(0, 0, {
        alex: answer(3, 2_000),
        greg: answer(1, 2_000),
        sam: answer(1, 2_500),
      }),
    ];

    // #when the awards are worked out
    const award = find(awardsFor(log, PLAYERS), 'contrarian');

    // #then only the lonely wrong answer counts — being wrong with the crowd is
    // a bad question, not a decision
    expect(award).toEqual({ id: 'contrarian', uids: ['alex'], count: 1 });
  });

  test('ignores a correct answer nobody else found', () => {
    // #given one player right on their own
    const log = [record(0, 0, { alex: answer(0, 2_000), greg: answer(1, 2_000) })];

    // #when the awards are worked out
    const award = find(awardsFor(log, PLAYERS), 'contrarian');

    // #then being alone and right is the other award, not this one
    expect(award?.uids).toEqual(['greg']);
  });
});

describe('comeback', () => {
  test('measures the climb from a player’s worst position to their last', () => {
    // #given Sam scoring nothing early and everything late
    const log = [
      record(0, 0, {}, { greg: 1_000, priya: 900, alex: 800 }),
      record(1, 0, {}, { greg: 1_000, priya: 900, alex: 800 }),
      record(2, 0, {}, { sam: 1_000 }),
      record(3, 0, {}, { sam: 1_000 }),
      record(4, 0, {}, { sam: 1_000 }),
    ];

    // #when the awards are worked out
    const award = find(awardsFor(log, PLAYERS), 'comeback');

    // #then Sam is credited with the rise from last to first
    expect(award).toEqual({ id: 'comeback', uids: ['sam'], from: 4, to: 1 });
  });

  test('is not awarded when nobody moved up', () => {
    // #given a game whose order never changed
    const log = [
      record(0, 0, {}, { greg: 1_000, sam: 500 }),
      record(1, 0, {}, { greg: 1_000, sam: 500 }),
    ];

    // #when the awards are worked out
    const award = find(awardsFor(log, PLAYERS), 'comeback');

    // #then there is no comeback to report
    expect(award).toBeUndefined();
  });
});

describe('awardsFor', () => {
  test('returns nothing for a game with no questions logged', () => {
    // #given an empty log, as a client that joined at the final screen would have
    const log: QuestionRecord[] = [];

    // #when the awards are worked out
    const awards = awardsFor(log, PLAYERS);

    // #then nothing is claimed about a game it did not see
    expect(awards).toEqual([]);
  });

  test('leaves out the awards nothing earned rather than showing them empty', () => {
    // #given a game where the only thing that happened was one shared right
    // answer, with the scores level throughout
    const log = [
      record(0, 0, { greg: answer(0, 1_000), sam: answer(0, 1_000) }, { greg: 900, sam: 900 }),
    ];

    // #when the awards are worked out
    const ids = awardsFor(log, ['greg', 'sam']).map((award) => award.id);

    // #then only the fastest finger survives
    expect(ids).toEqual(['fastest']);
  });

  test('orders the awards it does have', () => {
    // #given a game with something for everybody. Three players rather than two,
    // because with two every wrong answer is also a lonely one and the
    // contrarian cannot be told apart from simply being wrong.
    const log = [
      record(
        0,
        0,
        { greg: answer(0, 800), sam: answer(1, 2_000), alex: answer(1, 2_200) },
        { greg: 960, sam: 0, alex: 0 },
      ),
      record(
        1,
        1,
        { sam: answer(1, 1_200), greg: answer(1, 3_000), alex: answer(3, 2_000) },
        { sam: 900, greg: 700, alex: 0 },
      ),
      record(
        2,
        2,
        { sam: answer(2, 1_000), greg: answer(0, 2_000), alex: answer(0, 2_500) },
        { sam: 950, greg: 0, alex: 0 },
      ),
    ];

    // #when the awards are worked out
    const ids = awardsFor(log, ['greg', 'sam', 'alex']).map((award) => award.id);

    // #then they come back in reading order
    expect(ids).toEqual(['fastest', 'comeback', 'lone-wolf', 'contrarian']);
  });

  test('reads a whole game correctly end to end', () => {
    // #given the same game
    const log = [
      record(
        0,
        0,
        { greg: answer(0, 800), sam: answer(1, 2_000), alex: answer(1, 2_200) },
        { greg: 960, sam: 0, alex: 0 },
      ),
      record(
        1,
        1,
        { sam: answer(1, 1_200), greg: answer(1, 3_000), alex: answer(3, 2_000) },
        { sam: 900, greg: 700, alex: 0 },
      ),
      record(
        2,
        2,
        { sam: answer(2, 1_000), greg: answer(0, 2_000), alex: answer(0, 2_500) },
        { sam: 950, greg: 0, alex: 0 },
      ),
    ];

    // #when the awards are worked out
    const awards = awardsFor(log, ['greg', 'sam', 'alex']);

    // #then each one names the right player for the right reason: Greg's 800ms
    // opener, Sam overhauling him from second, the two questions only one person
    // got, and Alex alone on a wrong answer
    expect(find(awards, 'fastest')).toEqual({ id: 'fastest', uids: ['greg'], elapsedMs: 800 });
    expect(find(awards, 'comeback')).toEqual({ id: 'comeback', uids: ['sam'], from: 2, to: 1 });
    expect(find(awards, 'lone-wolf')).toEqual({
      id: 'lone-wolf',
      uids: ['greg', 'sam'],
      count: 1,
    });
    expect(find(awards, 'contrarian')).toEqual({ id: 'contrarian', uids: ['alex'], count: 1 });
  });
});

describe('the round in review', () => {
  test('names the question nobody got', () => {
    // #given a question three people answered and all three got wrong
    const log = [
      record(0, 0, { greg: answer(0, 900), sam: answer(0, 1_200) }),
      record(1, 3, { greg: answer(1, 900), sam: answer(2, 1_200), alex: answer(0, 1_400) }),
    ];

    // #when the round is reviewed
    const review = reviewFor(log);

    // #then the second question is the stumper, carrying how many it beat
    expect(review).toContainEqual({ id: 'stumper', index: 1, attempts: 3 });
  });

  test('names the question everybody got', () => {
    // #given a question every one of three answerers got right
    const log = [
      record(0, 2, { greg: answer(2, 900), sam: answer(2, 1_200), alex: answer(2, 1_400) }),
      record(1, 0, { greg: answer(1, 900), sam: answer(0, 1_200) }),
    ];

    // #when the round is reviewed
    const review = reviewFor(log);

    // #then the clean sweep is the first question
    expect(review).toContainEqual({ id: 'sweep', index: 0, attempts: 3 });
  });

  test('ignores a question only one person answered', () => {
    // #given a lone wrong answer and a lone right one, and nothing else
    const log = [
      record(0, 0, { greg: answer(1, 900) }),
      record(1, 0, { sam: answer(0, 900) }),
    ];

    // #when the round is reviewed
    const review = reviewFor(log);

    // #then neither counts — one person is not a room, and being right alone is
    // already the lone wolf's rosette
    expect(review).toEqual([]);
  });

  test('ignores a question nobody answered at all', () => {
    // #given a question the whole room sat out
    const log = [record(0, 0, {})];

    // #when the round is reviewed
    const review = reviewFor(log);

    // #then it is not a question that beat anybody
    expect(review).toEqual([]);
  });

  test('prefers the question that beat the most people', () => {
    // #given two questions nobody got, answered by different numbers of people
    const log = [
      record(0, 0, { greg: answer(1, 900), sam: answer(2, 1_200) }),
      record(1, 0, { greg: answer(1, 900), sam: answer(2, 1_200), alex: answer(3, 1_400) }),
    ];

    // #when the round is reviewed
    const review = reviewFor(log);

    // #then the one more of the room got wrong is the one worth naming
    expect(review).toContainEqual({ id: 'stumper', index: 1, attempts: 3 });
  });

  test('settles a tie on the earliest question, whatever order the log is in', () => {
    // #given two equally stumping questions, with the log holding them backwards
    const log = [
      record(4, 0, { greg: answer(1, 900), sam: answer(2, 1_200) }),
      record(2, 0, { greg: answer(1, 900), sam: answer(2, 1_200) }),
    ];

    // #when the round is reviewed
    const review = reviewFor(log);

    // #then the earlier question wins, so two devices that assembled their logs
    // differently still name the same one
    expect(review).toContainEqual({ id: 'stumper', index: 2, attempts: 2 });
  });

  test('leaves out a highlight nothing earned', () => {
    // #given a round where every question was split
    const log = [
      record(0, 0, { greg: answer(0, 900), sam: answer(1, 1_200) }),
      record(1, 1, { greg: answer(0, 900), sam: answer(1, 1_200) }),
    ];

    // #when the round is reviewed
    const review = reviewFor(log);

    // #then it is empty rather than carrying two blank panels
    expect(review).toEqual([]);
  });
});
