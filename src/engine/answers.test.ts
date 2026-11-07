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

  test('carries only the two fields scoring reads, when nothing optional is set', () => {
    const docs = { greg: { optionIndex: 1, elapsedMs: 900, questionIndex: 0 } };

    expect(Object.keys(liveAnswers(players, 0, docs)['greg'] ?? {}).sort()).toEqual([
      'elapsedMs',
      'optionIndex',
    ]);
  });

  test('carries at when the document has one', () => {
    const docs = {
      greg: { optionIndex: 1, elapsedMs: 900, questionIndex: 0, at: 1_700_000_000_000 },
    };

    expect(liveAnswers(players, 0, docs)['greg']).toEqual({
      optionIndex: 1,
      elapsedMs: 900,
      at: 1_700_000_000_000,
    });
  });

  test('an empty room answers nothing', () => {
    expect(liveAnswers({}, 0, { greg: { optionIndex: 1, elapsedMs: 900, questionIndex: 0 } }))
      .toEqual({});
  });

  test('drops a same-index answer stamped before this question opened', () => {
    // The next round starts again at index 0. Index alone would score the
    // previous round's pick. `at` and `openedAt` are both the server's clock.
    const docs = {
      greg: { optionIndex: 1, elapsedMs: 900, questionIndex: 0, at: 4_999 },
      sam: { optionIndex: 2, elapsedMs: 1_200, questionIndex: 0, at: 5_000 },
    };

    expect(liveAnswers(players, 0, docs, 5_000)).toEqual({
      sam: { optionIndex: 2, elapsedMs: 1_200, at: 5_000 },
    });
  });

  test('keeps an answer with no at, including one stamped exactly at the open', () => {
    // Missing `at` is a pending server timestamp, or a client from before the
    // field. Rejecting it would drop a legitimate answer. Equal stamps count:
    // the same millisecond as the open is this question.
    const docs = {
      greg: { optionIndex: 1, elapsedMs: 900, questionIndex: 0 },
      sam: { optionIndex: 0, elapsedMs: 400, questionIndex: 0, at: 5_000 },
    };

    expect(liveAnswers(players, 0, docs, 5_000)).toEqual({
      greg: { optionIndex: 1, elapsedMs: 900 },
      sam: { optionIndex: 0, elapsedMs: 400, at: 5_000 },
    });
  });

  test('does not filter when this question has no resolved openedAt', () => {
    // A pending `serverTimestamp()` on the room reads as null. Dropping every
    // stamped answer then would hide a legitimate one until the open acknowledged.
    const docs = {
      greg: { optionIndex: 1, elapsedMs: 900, questionIndex: 0, at: 1_000 },
    };

    expect(liveAnswers(players, 0, docs, null)).toEqual({
      greg: { optionIndex: 1, elapsedMs: 900, at: 1_000 },
    });
  });
});
