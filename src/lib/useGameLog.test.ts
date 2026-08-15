import { describe, expect, test } from 'vitest';
import { parseLog } from './useGameLog';

const GAME = {
  gameId: 'game-1',
  records: [
    {
      index: 0,
      correctIndex: 2,
      answers: { greg: { optionIndex: 2, elapsedMs: 900 } },
      deltas: { greg: 960 },
    },
  ],
};

describe('parseLog', () => {
  test('reads back a log it wrote', () => {
    // #given a log serialised the way the hook stores it
    const raw = JSON.stringify(GAME);

    // #when it is read back
    const log = parseLog(raw);

    // #then it survives the round trip intact
    expect(log).toEqual(GAME);
  });

  test('treats an absent log as an empty one', () => {
    // #given nothing in storage
    // #when it is read
    const log = parseLog(null);

    // #then there is no game rather than a crash
    expect(log).toEqual({ gameId: null, records: [] });
  });

  test('treats unparseable storage as an empty log', () => {
    // #given something that is not JSON at all
    // #when it is read
    const log = parseLog('{ not json');

    // #then it falls back rather than throwing on the first render
    expect(log).toEqual({ gameId: null, records: [] });
  });

  test('rejects a log with no game id', () => {
    // #given a log whose game id has been tampered with
    const raw = JSON.stringify({ ...GAME, gameId: 42 });

    // #when it is read
    const log = parseLog(raw);

    // #then it is discarded, because a log that cannot say which game it belongs
    // to could be attached to the wrong one
    expect(log.gameId).toBeNull();
  });

  test('drops a record it cannot trust rather than repairing it', () => {
    // #given one good record and one missing its correct answer
    const raw = JSON.stringify({
      gameId: 'game-1',
      records: [GAME.records[0], { index: 1, answers: {}, deltas: {} }],
    });

    // #when it is read
    const log = parseLog(raw);

    // #then only the good one survives — a short log withholds the awards, which
    // is the safe direction to fail in
    expect(log.records).toEqual(GAME.records);
  });

  test('drops an answer that is not one', () => {
    // #given a record carrying a junk answer alongside a real one
    const raw = JSON.stringify({
      gameId: 'game-1',
      records: [
        {
          index: 0,
          correctIndex: 2,
          answers: { greg: { optionIndex: 2, elapsedMs: 900 }, sam: 'nonsense' },
          deltas: { greg: 960, sam: 'nonsense' },
        },
      ],
    });

    // #when it is read
    const log = parseLog(raw);

    // #then the junk is gone and the real answer is untouched
    expect(log.records[0]).toEqual(GAME.records[0]);
  });
});
