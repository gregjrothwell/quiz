import { describe, expect, test } from 'vitest';
import type { GameRecord, RecordedQuestion } from '../src/engine/gameRecord';
import {
  compareSeason,
  scoreIntegrity,
  scoredByName,
  tallyPlayers,
} from './player-report';

function question(extra: Partial<RecordedQuestion> = {}): RecordedQuestion {
  return {
    id: 'q0',
    index: 0,
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

function game(extra: Partial<GameRecord> = {}): GameRecord {
  return {
    roomCode: 'ABCD',
    packId: 'science',
    packTitle: 'Science',
    durationSecs: 10,
    wagerEnabled: false,
    stealEnabled: false,
    jigsawEnabled: false,
    players: {
      ali: { name: 'Alistair' },
      greg: { name: 'Greg' },
      sam: { name: 'Sam' },
    },
    scores: { ali: 1_000, greg: 500 },
    questions: [],
    writtenBy: 'greg',
    ...extra,
  };
}

describe('tallyPlayers', () => {
  test('splits elapsed by right and wrong, and names the gap', () => {
    const record = game({
      questions: [
        question({
          answers: {
            ali: { optionIndex: 1, elapsedMs: 2_000 },
            greg: { optionIndex: 0, elapsedMs: 6_000 },
          },
          deltas: { ali: 1_000, greg: 0 },
        }),
        question({
          id: 'q1',
          index: 1,
          answers: {
            ali: { optionIndex: 0, elapsedMs: 2_200 },
            greg: { optionIndex: 1, elapsedMs: 5_000 },
          },
          deltas: { ali: 0, greg: 1_000 },
        }),
      ],
      scores: { ali: 1_000, greg: 1_000 },
    });

    const stats = tallyPlayers([{ gameId: 'g1', record }]);
    const ali = stats.find((row) => row.name === 'Alistair');
    const greg = stats.find((row) => row.name === 'Greg');

    expect(ali).toMatchObject({
      answers: 2,
      correct: 1,
      medianElapsedRightMs: 2_000,
      medianElapsedWrongMs: 2_200,
      rightWrongGapMs: -200,
    });
    expect(greg?.rightWrongGapMs).toBe(5_000 - 6_000);
  });

  test('implied delay is relative to the room, not an absolute clock', () => {
    // Two honest writes pin openedAt; Ali claims 0ms but arrives with them.
    const opened = 1_000_000;
    const record = game({
      questions: [
        question({
          answers: {
            ali: { optionIndex: 1, elapsedMs: 0, at: opened + 2_000 },
            greg: { optionIndex: 1, elapsedMs: 2_000, at: opened + 2_020 },
            sam: { optionIndex: 0, elapsedMs: 2_100, at: opened + 2_130 },
          },
          deltas: { ali: 1_000, greg: 500, sam: 0 },
        }),
      ],
      scores: { ali: 1_000, greg: 500, sam: 0 },
    });

    const ali = tallyPlayers([{ gameId: 'g1', record }]).find((row) => row.name === 'Alistair');
    expect(ali?.medianImpliedDelayMs).toBeGreaterThan(1_000);
    expect(ali?.delaysObserved).toBe(1);
  });

  test('an honest pair sits near zero delay', () => {
    const opened = 1_000_000;
    const record = game({
      players: { ali: { name: 'Alistair' }, greg: { name: 'Greg' } },
      questions: [
        question({
          answers: {
            ali: { optionIndex: 1, elapsedMs: 2_000, at: opened + 2_020 },
            greg: { optionIndex: 1, elapsedMs: 2_100, at: opened + 2_130 },
          },
          deltas: { ali: 1_000, greg: 500 },
        }),
      ],
      scores: { ali: 1_000, greg: 500 },
    });

    const stats = tallyPlayers([{ gameId: 'g1', record }]);
    for (const row of stats) {
      expect(row.medianImpliedDelayMs).not.toBeNull();
      expect(Math.abs(row.medianImpliedDelayMs ?? 999)).toBeLessThan(50);
    }
  });
});

describe('scoreIntegrity', () => {
  test('is clean when stored scores equal the summed deltas', () => {
    const record = game({
      questions: [
        question({
          answers: { ali: { optionIndex: 1, elapsedMs: 2_000 } },
          deltas: { ali: 1_000, greg: 0 },
        }),
      ],
      scores: { ali: 1_000, greg: 0 },
    });

    expect(scoreIntegrity([{ gameId: 'g1', record }])).toEqual([]);
  });

  test('names a uid whose stored score does not match the deltas', () => {
    const record = game({
      questions: [
        question({
          deltas: { ali: 1_000, greg: 0 },
        }),
      ],
      scores: { ali: 50_000, greg: 0 },
    });

    expect(scoreIntegrity([{ gameId: 'g1', record }])).toEqual([
      { gameId: 'g1', uid: 'ali', stored: 50_000, summed: 1_000 },
    ]);
  });

  test('a skipped question’s deltas do not count', () => {
    const record = game({
      questions: [
        question({ skipped: true, deltas: { ali: 1_000 }, answers: {} }),
      ],
      scores: { ali: 0, greg: 0 },
    });

    expect(scoreIntegrity([{ gameId: 'g1', record }])).toEqual([]);
  });
});

describe('compareSeason', () => {
  test('pairs a season row with the games that share the name', () => {
    const record = game({ scores: { ali: 1_000, greg: 500 } });
    const kept = [{ gameId: 'g1', record }];
    const stats = tallyPlayers(kept);
    const comparison = compareSeason(
      stats,
      [{ name: 'Alistair', points: 399_645, played: 9 }],
      scoredByName(kept),
    );

    expect(comparison.find((row) => row.name === 'Alistair')).toMatchObject({
      seasonPoints: 399_645,
      scoredInGames: 1_000,
      gamesPlayed: 1,
      seasonPlayed: 9,
    });
    expect(comparison.find((row) => row.name === 'Greg')?.seasonPoints).toBeNull();
  });
});
