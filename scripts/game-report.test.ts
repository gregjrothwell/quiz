import { describe, expect, test } from 'vitest';
import type { GameRecord, RecordedQuestion } from '../src/engine/gameRecord';
import {
  median,
  parseGameRecord,
  revealCost,
  summariseGame,
  summariseQuestion,
  tallyByKind,
} from './game-report';

function textQuestion(index: number, extra: Partial<RecordedQuestion> = {}): RecordedQuestion {
  return {
    id: `q${index}`,
    index,
    category: 'Science',
    difficulty: 'medium',
    kind: 'text',
    correctIndex: 1,
    skipped: false,
    answers: {},
    deltas: {},
    ...extra,
  };
}

/** Four seats: two right, one wrong, one silent. */
const FOUR_SEATS: GameRecord = {
  roomCode: 'ABCD',
  packId: 'science',
  packTitle: 'Science',
  durationSecs: 15,
  wagerEnabled: true,
  stealEnabled: false,
  jigsawEnabled: false,
  players: { a: { name: 'A' }, b: { name: 'B' }, c: { name: 'C' }, d: { name: 'D' } },
  scores: { a: 1_000, b: 900, c: 0, d: 0 },
  questions: [
    textQuestion(0, {
      answers: {
        a: { optionIndex: 1, elapsedMs: 3_000 },
        b: { optionIndex: 1, elapsedMs: 5_000, firstMs: 40 },
        c: { optionIndex: 0, elapsedMs: 7_000 },
      },
      deltas: { a: 1_000, b: 900, c: 0 },
    }),
  ],
  writtenBy: 'a',
};

describe('median', () => {
  test('is null for nothing', () => {
    expect(median([])).toBeNull();
  });

  test('is the middle of an odd list', () => {
    expect(median([7, 1, 3])).toBe(3);
  });

  test('is the mean of the middle pair of an even list', () => {
    expect(median([1, 2, 3, 10])).toBe(2.5);
  });
});

describe('summariseQuestion', () => {
  test('counts correct over seats, not over answers', () => {
    // #given two right, one wrong, one silent
    const question = FOUR_SEATS.questions[0]!;

    // #when
    const summary = summariseQuestion(question, 4);

    // #then — the silent seat is a miss, as the room experienced it
    expect([summary.answered, summary.correct, summary.hitRate]).toEqual([3, 2, 0.5]);
  });

  test('takes the median over every answer given, right or wrong', () => {
    expect(summariseQuestion(FOUR_SEATS.questions[0]!, 4).medianElapsedMs).toBe(5_000);
  });

  test('counts a first touch under a second as a snap', () => {
    expect(summariseQuestion(FOUR_SEATS.questions[0]!, 4).snaps).toBe(1);
  });

  test('a skipped question has no hit rate', () => {
    // #given — thrown out before its reveal
    const question = textQuestion(3, { skipped: true, correctIndex: null });

    // #then
    expect(summariseQuestion(question, 4)).toMatchObject({ hitRate: null, answered: 0, correct: 0 });
  });

  test('a question nobody answered has no median', () => {
    expect(summariseQuestion(textQuestion(1), 4).medianElapsedMs).toBeNull();
  });
});

describe('summariseGame', () => {
  test('leaves skipped questions out of the round’s hit rate', () => {
    // #given — one played question at 50%, one skipped
    const record: GameRecord = {
      ...FOUR_SEATS,
      questions: [FOUR_SEATS.questions[0]!, textQuestion(1, { skipped: true, correctIndex: null })],
    };

    // #when
    const summary = summariseGame('game-1', record, null);

    // #then
    expect([summary.questionCount, summary.skipped, summary.hitRate]).toEqual([2, 1, 0.5]);
  });

  test('names the flags the round was played under', () => {
    expect(summariseGame('game-1', FOUR_SEATS, null).flags).toEqual(['wager']);
  });

  test('carries the stamp it was given', () => {
    const at = new Date('2026-09-08T18:00:00Z');
    expect(summariseGame('game-1', FOUR_SEATS, at).finishedAt).toBe(at);
  });
});

describe('tallyByKind', () => {
  test('separates how each kind of question plays', () => {
    // #given a text question at 50% and a melody question at 25%, same four seats
    const record: GameRecord = {
      ...FOUR_SEATS,
      questions: [
        FOUR_SEATS.questions[0]!,
        textQuestion(1, {
          kind: 'melody',
          answers: { a: { optionIndex: 1, elapsedMs: 9_000 }, b: { optionIndex: 0, elapsedMs: 9_500 } },
        }),
      ],
    };

    // #when
    const tally = tallyByKind([record]);

    // #then
    expect([tally.text.hitRate, tally.melody.hitRate, tally.picture.hitRate]).toEqual([0.5, 0.25, null]);
  });

  test('counts a round towards a kind once, however many questions of it were asked', () => {
    // #given two text questions in one round
    const record: GameRecord = {
      ...FOUR_SEATS,
      questions: [FOUR_SEATS.questions[0]!, textQuestion(1)],
    };

    // #then
    expect(tallyByKind([record]).text).toMatchObject({ games: 1, questions: 2 });
  });

  test('leaves a skipped question out of the kind it belongs to', () => {
    // #given
    const record: GameRecord = {
      ...FOUR_SEATS,
      questions: [textQuestion(0, { kind: 'melody', skipped: true, correctIndex: null })],
    };

    // #then
    expect(tallyByKind([record]).melody).toMatchObject({ games: 0, questions: 0, hitRate: null });
  });
});

describe('parseGameRecord', () => {
  test('reads back exactly what the fold wrote', () => {
    expect(parseGameRecord(FOUR_SEATS)).toEqual(FOUR_SEATS);
  });

  test('ignores the server stamp, which is not part of the record', () => {
    expect(parseGameRecord({ ...FOUR_SEATS, finishedAt: { seconds: 1 } })).toEqual(FOUR_SEATS);
  });

  test('refuses a document with a pack the app has never heard of', () => {
    expect(parseGameRecord({ ...FOUR_SEATS, packId: 'made-up' })).toBeNull();
  });

  test('refuses a question with a kind that is not one of the three', () => {
    const questions = [textQuestion(0, { kind: 'video' as unknown as RecordedQuestion['kind'] })];
    expect(parseGameRecord({ ...FOUR_SEATS, questions })).toBeNull();
  });

  test('refuses an answer without a time', () => {
    const questions = [
      textQuestion(0, { answers: { a: { optionIndex: 1 } as unknown as RecordedQuestion['answers'][string] } }),
    ];
    expect(parseGameRecord({ ...FOUR_SEATS, questions })).toBeNull();
  });

  test('refuses anything that is not a document at all', () => {
    expect([parseGameRecord(null), parseGameRecord('round'), parseGameRecord([])]).toEqual([null, null, null]);
  });

  test('keeps a null correctIndex, which is what a pre-reveal skip leaves', () => {
    const questions = [textQuestion(0, { skipped: true, correctIndex: null })];
    expect(parseGameRecord({ ...FOUR_SEATS, questions })?.questions[0]?.correctIndex).toBeNull();
  });
});

/**
 * Round-tripping the reveal timing added on 11 September 2026, and the half that
 * matters more: the three rounds already in Firestore predate it, and a reader
 * that refused them would be a worse bug than the delay it was added to measure.
 */
describe('the reveal timing, read back', () => {
  const timed: RecordedQuestion = textQuestion(0, {
    reveal: { gateMs: 90, resolveMs: 260, dispatchMs: 140, attempts: 2 },
  });

  test('survives the round trip', () => {
    const record: GameRecord = { ...FOUR_SEATS, questions: [timed] };
    expect(parseGameRecord(record)).toEqual(record);
  });

  test('a record written before it existed still reads, without one', () => {
    const older: GameRecord = { ...FOUR_SEATS, questions: [textQuestion(0)] };
    const parsed = parseGameRecord(older);

    expect(parsed).toEqual(older);
    expect(parsed?.questions[0]).not.toHaveProperty('reveal');
  });

  test('a half-written one is dropped rather than printed as if measured', () => {
    const broken = {
      ...FOUR_SEATS,
      questions: [{ ...textQuestion(0), reveal: { gateMs: 90, resolveMs: 260 } }],
    };
    const parsed = parseGameRecord(broken);

    // #then the round still reads — one bad field is not worth losing a game for
    expect(parsed).not.toBeNull();
    // #but nothing claims to know what the reveal cost
    expect(parsed?.questions[0]).not.toHaveProperty('reveal');
  });

  test('summarises as null when the record has none, not as zero', () => {
    expect(summariseQuestion(textQuestion(0), 4).reveal).toBeNull();
    expect(summariseQuestion(timed, 4).reveal).toEqual(timed.reveal);
  });
});

/**
 * The column itself. Worth its own test because the live rounds cannot exercise
 * it — all three predate the field, so against real data it can only print a
 * dash. It lives here rather than beside `read-games` because that module calls
 * `main()` at import: a test that imported it would talk to Firestore, and
 * `npm test` has to keep running offline.
 */
describe('revealCost', () => {
  test('leads with the total, because that is what a slow round is scanned for', () => {
    expect(revealCost({ gateMs: 90, resolveMs: 260, dispatchMs: 140, attempts: 1 })).toBe(
      '  0.5s (90+260+140)',
    );
  });

  test('marks a reveal that had to ask more than once', () => {
    expect(revealCost({ gateMs: 120, resolveMs: 4_000, dispatchMs: 300, attempts: 3 })).toBe(
      '  4.4s (120+4000+300) x3',
    );
  });

  test('says nothing rather than zero when this device did not reveal', () => {
    expect(revealCost(null)).toBe('     —');
  });

  test('pads the total to a fixed width, so the column reads down the page', () => {
    const widths = [
      revealCost({ gateMs: 0, resolveMs: 100, dispatchMs: 0, attempts: 1 }),
      revealCost({ gateMs: 0, resolveMs: 40_000, dispatchMs: 0, attempts: 1 }),
      revealCost(null),
    ].map((cell) => (cell.indexOf('(') === -1 ? cell.length : cell.indexOf('(') - 1));

    expect(new Set(widths).size).toBe(1);
  });
});
