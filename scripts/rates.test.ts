import { describe, expect, test } from 'vitest';
import type { GameRecord, RecordedQuestion } from '../src/engine/gameRecord';
import { foldRates } from './rates';

/*
  The rates fold (beat-the-chaser.md, S1–S3): what counts, where a random
  round's questions are credited, and that the same history folds the same.
*/

function question(id: string, difficulty: RecordedQuestion['difficulty'], picks: number[], extra: Partial<RecordedQuestion> = {}): RecordedQuestion {
  return {
    id,
    index: 0,
    category: 'c',
    difficulty,
    kind: 'text',
    correctIndex: 0,
    skipped: false,
    answers: Object.fromEntries(picks.map((optionIndex, i) => [`u${String(i)}`, { optionIndex, elapsedMs: 1_000 }])),
    deltas: {},
    ...extra,
  };
}

function game(packId: GameRecord['packId'], questions: RecordedQuestion[]): GameRecord {
  return {
    roomCode: 'ABCD', packId, packTitle: 'p', durationSecs: 10, wagerEnabled: false, stealEnabled: false,
    jigsawEnabled: false, players: {}, scores: {}, questions, writtenBy: 'h',
  };
}

describe('foldRates', () => {
  test('tallies right out of answered, by pack and difficulty', () => {
    const rates = foldRates([{ id: 'g1', record: game('screens', [question('a', 'easy', [0, 0, 1]), question('b', 'hard', [1, 1])]) }], new Map());
    expect(rates.overall).toEqual({ hits: 2, tries: 5 });
    expect(rates.byPack).toEqual({ screens: { easy: { hits: 2, tries: 3 }, hard: { hits: 0, tries: 2 } } });
  });

  test('a random round credits each question to the pack it came from', () => {
    const rates = foldRates([{ id: 'g1', record: game('random', [question('s1', 'easy', [0]), question('lost', 'easy', [0])]) }], new Map([['s1', 'sleeves']]));
    expect(Object.keys(rates.byPack)).toEqual(['sleeves']);
    expect(rates.byDifficulty['easy']).toEqual({ hits: 2, tries: 2 });
  });

  test('leaves out skipped questions, Survey Says, unrevealed questions and harness rounds', () => {
    const rates = foldRates(
      [
        { id: 'g1', record: game('screens', [question('a', 'easy', [0], { skipped: true }), question('b', 'easy', [0], { correctIndex: null })]) },
        { id: 'g2', record: game('survey', [question('c', 'easy', [0], { survey: { part: 'guess', promptId: 'p' } })]) },
        { id: 'rank-123', record: game('screens', [question('d', 'easy', [0])]) },
      ],
      new Map(),
    );
    expect(rates.overall).toEqual({ hits: 0, tries: 0 });
  });

  test('S3: the same history folds to the same file, whatever order it was read in', () => {
    const one = { id: 'g1', record: game('screens', [question('a', 'easy', [0])]) };
    const two = { id: 'g2', record: game('blanks', [question('b', 'hard', [1])]) };
    expect(JSON.stringify(foldRates([one, two], new Map()))).toBe(JSON.stringify(foldRates([two, one], new Map())));
  });
});
