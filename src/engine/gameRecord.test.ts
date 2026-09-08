import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import type { QuestionRecord } from './awards';
import {
  GAME_DOCUMENT_KEYS,
  GAME_RECORD_KEYS,
  foldGameRecord,
  kindOf,
  type GameRecord,
} from './gameRecord';
import { createRoom, type Player, type QuizQuestion, type RoomState } from './state';

const OPTIONS = ['A', 'B', 'C', 'D'];

function question(id: string, extra: Partial<QuizQuestion> = {}): QuizQuestion {
  return {
    id,
    prompt: `Question ${id}`,
    options: OPTIONS,
    correctIndex: null,
    category: 'General Knowledge',
    difficulty: 'medium',
    ...extra,
  };
}

const PLAYERS: Record<string, Player> = {
  greg: { name: 'Greg', joinedAt: 1, squad: 'Hermes' },
  sam: { name: 'Sam', joinedAt: 2 },
};

/** A two-question round as the reducer leaves it at the whistle. */
function finishedRoom(overrides: Partial<RoomState> = {}): RoomState {
  return {
    ...createRoom('ABCD'),
    phase: 'finished',
    players: PLAYERS,
    packId: 'science',
    packTitle: 'Science',
    questions: [question('q1'), question('q2')],
    index: 1,
    durationSecs: 15,
    scores: { greg: 1_900, sam: 500 },
    gameId: 'game-1',
    ...overrides,
  };
}

const WHOLE_LOG: QuestionRecord[] = [
  {
    index: 0,
    correctIndex: 2,
    answers: {
      greg: { optionIndex: 2, elapsedMs: 3_400 },
      sam: { optionIndex: 1, elapsedMs: 5_000, firstMs: 50 },
    },
    deltas: { greg: 1_000, sam: 0 },
  },
  {
    index: 1,
    correctIndex: 0,
    answers: {
      greg: { optionIndex: 0, elapsedMs: 4_100, wager: 100 },
      sam: { optionIndex: 0, elapsedMs: 6_200 },
    },
    deltas: { greg: 900, sam: 500 },
  },
];

describe('foldGameRecord', () => {
  test('keeps a whole round, question by question', () => {
    // #given
    const room = finishedRoom();

    // #when
    const record = foldGameRecord(room, WHOLE_LOG, 'greg');

    // #then
    const expected: GameRecord = {
      roomCode: 'ABCD',
      packId: 'science',
      packTitle: 'Science',
      durationSecs: 15,
      wagerEnabled: false,
      stealEnabled: false,
      jigsawEnabled: false,
      players: { greg: { name: 'Greg', squad: 'Hermes' }, sam: { name: 'Sam' } },
      scores: { greg: 1_900, sam: 500 },
      questions: [
        {
          id: 'q1',
          index: 0,
          category: 'General Knowledge',
          difficulty: 'medium',
          kind: 'text',
          correctIndex: 2,
          skipped: false,
          answers: {
            greg: { optionIndex: 2, elapsedMs: 3_400 },
            sam: { optionIndex: 1, elapsedMs: 5_000, firstMs: 50 },
          },
          deltas: { greg: 1_000, sam: 0 },
        },
        {
          id: 'q2',
          index: 1,
          category: 'General Knowledge',
          difficulty: 'medium',
          kind: 'text',
          correctIndex: 0,
          skipped: false,
          answers: {
            greg: { optionIndex: 0, elapsedMs: 4_100, wager: 100 },
            sam: { optionIndex: 0, elapsedMs: 6_200 },
          },
          deltas: { greg: 900, sam: 500 },
        },
      ],
      writtenBy: 'greg',
    };
    expect(record).toEqual(expected);
  });

  test('produces exactly the keys the ruleset is told about', () => {
    // #given
    const record = foldGameRecord(finishedRoom(), WHOLE_LOG, 'greg');

    // #then
    expect(Object.keys(record ?? {}).sort()).toEqual([...GAME_RECORD_KEYS].sort());
  });

  test('the stored document is the fold plus the server stamp', () => {
    expect(GAME_DOCUMENT_KEYS).toEqual([...GAME_RECORD_KEYS, 'finishedAt']);
  });

  test('carries the round flags the room was played under', () => {
    // #given
    const room = finishedRoom({ wagerEnabled: true, stealEnabled: true, jigsawEnabled: true });

    // #when
    const record = foldGameRecord(room, WHOLE_LOG, 'greg');

    // #then
    expect([record?.wagerEnabled, record?.stealEnabled, record?.jigsawEnabled]).toEqual([
      true,
      true,
      true,
    ]);
  });

  test('refuses a log with a question missing that was not skipped', () => {
    // #given — this device missed the first reveal
    const room = finishedRoom();
    const partial = WHOLE_LOG.slice(1);

    // #when
    const record = foldGameRecord(room, partial, 'greg');

    // #then
    expect(record).toBeNull();
  });

  test('records a question thrown out before its reveal as skipped, with no answer', () => {
    // #given — the quizmaster skipped q1 during the question, so it never revealed
    const room = finishedRoom({ skipped: ['q1'] });
    const log = WHOLE_LOG.slice(1);

    // #when
    const record = foldGameRecord(room, log, 'greg');

    // #then
    expect(record?.questions[0]).toEqual({
      id: 'q1',
      index: 0,
      category: 'General Knowledge',
      difficulty: 'medium',
      kind: 'text',
      correctIndex: null,
      skipped: true,
      answers: {},
      deltas: {},
    });
  });

  test('records a question thrown out after its reveal with its answers and the skip', () => {
    // #given — q1 revealed, then the quizmaster threw it out and the points came back
    const room = finishedRoom({ skipped: ['q1'] });

    // #when
    const record = foldGameRecord(room, WHOLE_LOG, 'greg');

    // #then
    expect(record?.questions[0]).toMatchObject({
      skipped: true,
      correctIndex: 2,
      answers: WHOLE_LOG[0]?.answers,
      deltas: WHOLE_LOG[0]?.deltas,
    });
  });

  test('a skipped question still leaves the rest of the round intact', () => {
    // #given
    const room = finishedRoom({ skipped: ['q1'] });

    // #when
    const record = foldGameRecord(room, WHOLE_LOG.slice(1), 'greg');

    // #then
    expect(record?.questions.map((entry) => [entry.id, entry.skipped])).toEqual([
      ['q1', true],
      ['q2', false],
    ]);
  });

  test('refuses a room with no pack, which is a lobby and not a round', () => {
    // #given
    const room = finishedRoom({ packId: null, packTitle: null, questions: [] });

    // #when
    const record = foldGameRecord(room, [], 'greg');

    // #then
    expect(record).toBeNull();
  });

  test('refuses a round with no questions, so an empty record is never written', () => {
    // #given
    const room = finishedRoom({ questions: [] });

    // #when
    const record = foldGameRecord(room, [], 'greg');

    // #then
    expect(record).toBeNull();
  });

  test('an unchanged answer carries no firstMs key at all', () => {
    // #given
    const record = foldGameRecord(finishedRoom(), WHOLE_LOG, 'greg');

    // #then — Firestore refuses `undefined`, so absent has to mean absent
    const greg = record?.questions[0]?.answers.greg;
    expect(greg !== undefined && 'firstMs' in greg).toBe(false);
  });

  test('a stray field on an answer does not reach the record', () => {
    // #given — whatever an older bundle or a curious player put in storage
    const log: QuestionRecord[] = [
      {
        ...WHOLE_LOG[0]!,
        answers: {
          greg: { optionIndex: 2, elapsedMs: 3_400, colour: 'red' } as unknown as QuestionRecord['answers'][string],
        },
      },
      WHOLE_LOG[1]!,
    ];

    // #when
    const record = foldGameRecord(finishedRoom(), log, 'greg');

    // #then
    expect(record?.questions[0]?.answers.greg).toEqual({ optionIndex: 2, elapsedMs: 3_400 });
  });

  test('a player entry keeps the name and the side and nothing else', () => {
    // #given
    const room = finishedRoom({
      players: { greg: { name: 'Greg', joinedAt: 1, playerId: 'claimed-id', squad: 'Hermes' } },
      scores: { greg: 0 },
    });

    // #when
    const record = foldGameRecord(room, WHOLE_LOG, 'greg');

    // #then
    expect(record?.players).toEqual({ greg: { name: 'Greg', squad: 'Hermes' } });
  });

  test('a fifteen-question round of eight is a small document', () => {
    // #given — every player changes their mind and stakes, the largest an answer gets
    const uids = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'];
    const players = Object.fromEntries(
      uids.map((uid, i) => [uid, { name: `Player ${i + 1}`, joinedAt: i, squad: 'Bundae' }]),
    );
    const questions = Array.from({ length: 15 }, (_, i) => question(`question-${i}`));
    const log: QuestionRecord[] = questions.map((_, index) => ({
      index,
      correctIndex: index % 4,
      answers: Object.fromEntries(
        uids.map((uid) => [uid, { optionIndex: index % 4, elapsedMs: 4_321, firstMs: 50, wager: 100 }]),
      ),
      deltas: Object.fromEntries(uids.map((uid) => [uid, 1_000])),
    }));
    const room = finishedRoom({
      players,
      questions,
      index: 14,
      scores: Object.fromEntries(uids.map((uid) => [uid, 15_000])),
    });

    // #when
    const record = foldGameRecord(room, log, 'p1');

    // #then — the ceiling is 1 MiB; this leaves two orders of magnitude
    expect(JSON.stringify(record).length).toBeLessThan(64 * 1024);
  });
});

/**
 * The same guard `firstMs` and the answer window have. `firestore.rules` is
 * pasted into the console by hand, so the repo copy and the client drift
 * silently — and here the drift is total rather than cosmetic: `hasOnly`
 * refuses the whole document, so one key the rules have not heard of means no
 * round is ever kept, and nothing on screen says so.
 */
describe('the game record agrees with the security rules', () => {
  const RULES = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');
  const block = /match \/games\/\{gameId\} \{([\s\S]*?)\n {4}\}/.exec(RULES)?.[1] ?? '';

  function quotedNames(list: string | undefined): string[] {
    return [...(list ?? '').matchAll(/'([^']+)'/g)].map((match) => match[1] ?? '').sort();
  }

  test('the rules block exists', () => {
    expect(block).not.toBe('');
  });

  test('the hasOnly list is exactly the document the client writes', () => {
    const hasOnly = /hasOnly\(\[([^\]]*)\]\)/.exec(block)?.[1];
    expect(quotedNames(hasOnly)).toEqual([...GAME_DOCUMENT_KEYS].sort());
  });

  test('every key is required, so a half-written record is refused', () => {
    const hasAll = /hasAll\(\[([^\]]*)\]\)/.exec(block)?.[1];
    expect(quotedNames(hasAll)).toEqual([...GAME_DOCUMENT_KEYS].sort());
  });

  test('a record can never be rewritten or read back by a client', () => {
    expect(block).toMatch(/allow read: if false;/);
    expect(block).toMatch(/allow update: if false;/);
  });

  test('the headcount and question ceilings mirror the room’s own', () => {
    // The two functions are scoped to `/rooms` and cannot be called from
    // here, so the literals are repeated — and this is what stops them
    // drifting when the room's bounds move.
    const maxPlayers = /function maxPlayers\(\) \{ return (\d+); \}/.exec(RULES)?.[1];
    const maxQuestions = /function maxQuestions\(\) \{ return (\d+); \}/.exec(RULES)?.[1];
    const players = /players\.size\(\) <= (\d+)/.exec(block)?.[1];
    const questions = /questions\.size\(\) <= (\d+)/.exec(block)?.[1];
    expect([players, questions]).toEqual([maxPlayers, maxQuestions]);
  });
});

describe('kindOf', () => {
  test('a question with voices is a melody', () => {
    expect(
      kindOf({ voices: [{ type: 'triangle', from: 440, start: 0, duration: 0.3, gain: 0.7 }] }),
    ).toBe('melody');
  });

  test('a question with an image is a picture', () => {
    expect(kindOf({ image: 'abc123.jpg' })).toBe('picture');
  });

  test('a question with neither is text', () => {
    expect(kindOf({})).toBe('text');
  });

  test('an empty voices list is not a melody', () => {
    expect(kindOf({ voices: [] })).toBe('text');
  });
});
