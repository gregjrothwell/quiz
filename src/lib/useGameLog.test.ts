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

  /*
    The fixture above deliberately does not carry `firstMs` or `wager`, which is
    why it passed while both were being dropped. `toEqual` on a payload that
    never had the fields cannot notice their absence — the assertion was fine
    and the fixture was the hole.

    This matters beyond the hook: a reloaded log is what `foldGameRecord` folds
    into `games/{gameId}`, so anything lost here is lost from the permanent
    record of the round rather than from a screen that redraws.
  */
  test('carries firstMs and the wager through a reload', () => {
    // #given a log holding a revised snap guess and a stake
    const staked = {
      gameId: 'game-2',
      records: [
        {
          index: 0,
          correctIndex: 1,
          answers: {
            greg: { optionIndex: 1, elapsedMs: 5200, firstMs: 60 },
            rach: { optionIndex: 3, elapsedMs: 4100, wager: 50 },
          },
          deltas: { greg: 1000, rach: -400 },
        },
      ],
    };

    // #when the tab reloads and the log is read back
    const log = parseLog(JSON.stringify(staked));

    // #then the first touch and the stake are both still there
    expect(log).toEqual(staked);
    expect(log.records[0]?.answers.greg?.firstMs).toBe(60);
    expect(log.records[0]?.answers.rach?.wager).toBe(50);
  });

  test('leaves out an absent firstMs rather than writing undefined', () => {
    // #given an answer that was never changed, so it has no first touch
    const plain = {
      gameId: 'game-3',
      records: [
        {
          index: 0,
          correctIndex: 0,
          answers: { greg: { optionIndex: 0, elapsedMs: 3300 } },
          deltas: { greg: 1000 },
        },
      ],
    };

    // #when it is read back
    const answer = parseLog(JSON.stringify(plain)).records[0]?.answers.greg;

    // #then the key is absent, not present and undefined — Firestore refuses
    // to write undefined, and this object is on its way into `games/`.
    expect(answer).toEqual({ optionIndex: 0, elapsedMs: 3300 });
    expect(answer && 'firstMs' in answer).toBe(false);
    expect(answer && 'wager' in answer).toBe(false);
  });

  test('ignores a firstMs that is not a number', () => {
    // #given storage holding whatever an older build or a bored player left
    const junk = {
      gameId: 'game-4',
      records: [
        {
          index: 0,
          correctIndex: 0,
          answers: { greg: { optionIndex: 0, elapsedMs: 3300, firstMs: 'soon' } },
          deltas: { greg: 1000 },
        },
      ],
    };

    // #when it is read back
    const answer = parseLog(JSON.stringify(junk)).records[0]?.answers.greg;

    // #then the answer still parses and the bad field is dropped
    expect(answer).toEqual({ optionIndex: 0, elapsedMs: 3300 });
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
