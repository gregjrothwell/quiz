import { describe, expect, test } from 'vitest';
import { liveAnswers } from './answers';
import type { Player } from './state';

const players: Record<string, Player> = {
  greg: { name: 'Greg', joinedAt: 1 },
  sam: { name: 'Sam', joinedAt: 2 },
};

describe('liveAnswers', () => {
  test('keeps the answers to the question in play', () => {
    const docs = {
      greg: { optionIndex: 1, elapsedMs: 900, questionIndex: 3 },
      sam: { optionIndex: 2, elapsedMs: 1_200, questionIndex: 3 },
    };

    expect(liveAnswers(players, 3, docs)).toEqual({
      greg: { optionIndex: 1, elapsedMs: 900 },
      sam: { optionIndex: 2, elapsedMs: 1_200 },
    });
  });

  test('drops a document left over from the previous question', () => {
    // One document per player, overwritten each question — so a player who has
    // not answered yet still has last question's answer sitting there. Scoring
    // it again would credit them for a question they never touched.
    const docs = {
      greg: { optionIndex: 1, elapsedMs: 900, questionIndex: 3 },
      sam: { optionIndex: 2, elapsedMs: 1_200, questionIndex: 2 },
    };

    expect(liveAnswers(players, 3, docs)).toEqual({
      greg: { optionIndex: 1, elapsedMs: 900 },
    });
  });

  test('drops an answer from somebody the room does not list', () => {
    // Nothing checks membership on the way in — the room code is the capability
    // — so a client can write an answer to a room it never joined. It must not
    // score, and it must not inflate the answered count.
    const docs = {
      greg: { optionIndex: 1, elapsedMs: 900, questionIndex: 3 },
      stranger: { optionIndex: 0, elapsedMs: 5, questionIndex: 3 },
    };

    expect(liveAnswers(players, 3, docs)).toEqual({
      greg: { optionIndex: 1, elapsedMs: 900 },
    });
  });

  test('carries only the two fields scoring reads', () => {
    const docs = { greg: { optionIndex: 1, elapsedMs: 900, questionIndex: 0 } };

    expect(Object.keys(liveAnswers(players, 0, docs)['greg'] ?? {}).sort()).toEqual([
      'elapsedMs',
      'optionIndex',
    ]);
  });

  test('an empty room answers nothing', () => {
    expect(liveAnswers({}, 0, { greg: { optionIndex: 1, elapsedMs: 900, questionIndex: 0 } }))
      .toEqual({});
  });
});
