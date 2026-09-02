import { describe, expect, test } from 'vitest';
import { reduce, type Action } from './reducer';
import { stakeFor, tallyQuestion, WAGER_SHARES } from './scoring';
import { createRoom, isWagerQuestion, type QuizQuestion, type RoomState } from './state';

const at = (elapsedMs: number, optionIndex: number, wager?: number) => ({
  optionIndex,
  elapsedMs,
  ...(wager === undefined ? {} : { wager }),
});

describe('stakeFor', () => {
  test('is a share of what the player already holds', () => {
    expect(stakeFor(1000, 50)).toBe(500);
    expect(stakeFor(2400, 25)).toBe(600);
    expect(stakeFor(3000, 100)).toBe(3000);
  });

  test('is nothing without a wager', () => {
    expect(stakeFor(1000, undefined)).toBe(0);
    expect(stakeFor(1000, 0)).toBe(0);
  });

  /*
    The bound that keeps this to one ruleset paste. A stake can never exceed the
    points held, so a game total cannot go negative and `points >= 0` in
    `firestore.rules` is untouched. A crafted client sending 900 is clamped by
    every device identically rather than being trusted or refused.
  */
  test('cannot exceed the points held, whatever the client claims', () => {
    expect(stakeFor(1000, 900)).toBe(1000);
    expect(stakeFor(1000, -50)).toBe(0);
  });

  test('a player on nothing can stake nothing', () => {
    expect(stakeFor(0, 100)).toBe(0);
    // And a negative total, which nothing should produce, cannot mint points.
    expect(stakeFor(-500, 100)).toBe(0);
  });

  test('the shares offered are all inside the bound', () => {
    expect(WAGER_SHARES.every((share) => share >= 0 && share <= 100)).toBe(true);
  });
});

describe('tallyQuestion with stakes', () => {
  const answers = { win: at(100, 1, 50), lose: at(200, 3, 100), safe: at(300, 1) };
  const scores = { win: 2000, lose: 1000, safe: 800 };

  test('a correct answer wins its stake on top of the usual points', () => {
    const deltas = tallyQuestion({ correctIndex: 1, answers, scores });
    // 500 base + 500 for landing first + 1,000, half of the 2,000 held
    expect(deltas['win']).toBe(2000);
  });

  test('a wrong answer loses exactly its stake and no more', () => {
    const deltas = tallyQuestion({ correctIndex: 1, answers, scores });
    expect(deltas['lose']).toBe(-1000);
    expect((scores['lose'] ?? 0) + (deltas['lose'] ?? 0)).toBe(0);
  });

  test('a player who staked nothing is scored exactly as before', () => {
    const deltas = tallyQuestion({ correctIndex: 1, answers, scores });
    // 500 base + 400 for landing second among the correct answers
    expect(deltas['safe']).toBe(900);
  });

  /*
    The hole this closes. `wager` is written by the client, and nothing in the
    ruleset says which question it belongs to — bounding that server-side would
    cost a `get()` on every answer write. Instead the reducer passes `scores`
    only on the question that is actually being played for stakes, so a wager
    sent on question one is ignored by every device in the same way.
  */
  test('a wager on a question not played for stakes is ignored', () => {
    const deltas = tallyQuestion({ correctIndex: 1, answers });
    expect(deltas['win']).toBe(1000);
    expect(deltas['lose']).toBe(0);
    expect(deltas['safe']).toBe(900);
  });

  test('a wrong answer still reports zero rather than going missing', () => {
    // `verdictFor` tells `wrong` from `lost` by whether the key is there at all.
    const deltas = tallyQuestion({ correctIndex: 1, answers: { a: at(100, 2) }, scores: { a: 0 } });
    expect(Object.keys(deltas)).toEqual(['a']);
    expect(deltas['a']).toBe(0);
    expect(Object.is(deltas['a'], -0)).toBe(false);
  });

  test('the whole board can be undone again, which is what skip does', () => {
    const deltas = tallyQuestion({ correctIndex: 1, answers, scores });
    const after = Object.fromEntries(
      Object.entries(scores).map(([uid, points]) => [uid, points + (deltas[uid] ?? 0)]),
    );
    const undone = Object.fromEntries(
      Object.entries(after).map(([uid, points]) => [uid, points - (deltas[uid] ?? 0)]),
    );
    expect(undone).toEqual(scores);
  });

  test('nobody can be driven below zero by losing a stake', () => {
    const board = { a: 1200, b: 50, c: 0 };
    const wrong = {
      a: at(100, 9, 100),
      b: at(100, 9, 100),
      c: at(100, 9, 100),
    };
    const deltas = tallyQuestion({ correctIndex: 1, answers: wrong, scores: board });
    for (const uid of Object.keys(board)) {
      expect((board[uid as keyof typeof board]) + (deltas[uid] ?? 0)).toBeGreaterThanOrEqual(0);
    }
  });
});

/** Two questions, so "the last one" is a real distinction rather than the only one. */
const QUESTIONS: QuizQuestion[] = [0, 1].map((n) => ({
  id: `q${n}`,
  prompt: `Question ${n}?`,
  options: ['A', 'B', 'C', 'D'],
  correctIndex: null,
  category: 'General Knowledge',
  difficulty: 'medium' as const,
}));

function apply(state: RoomState, ...actions: Action[]): RoomState {
  return actions.reduce(reduce, state);
}

function roomPlayingForStakes(wagerEnabled: boolean): RoomState {
  return apply(
    createRoom('WGR1'),
    { type: 'join', uid: 'ann', name: 'Ann', at: 100 },
    { type: 'join', uid: 'bo', name: 'Bo', at: 200 },
    {
      type: 'selectPack',
      packId: 'general-knowledge',
      packTitle: 'General Knowledge',
      questions: QUESTIONS,
      wagerEnabled,
    },
    { type: 'start', at: 1_000, gameId: 'game-1', durationSecs: 20 },
  );
}

/** Plays the first question so both players carry points into the second. */
function onTheLastQuestion(wagerEnabled: boolean): RoomState {
  const opened = roomPlayingForStakes(wagerEnabled);
  return apply(
    opened,
    { type: 'answer', uid: 'ann', optionIndex: 0, elapsedMs: 1_000 },
    { type: 'answer', uid: 'bo', optionIndex: 0, elapsedMs: 2_000 },
    { type: 'reveal', correctIndex: 0, questionId: 'q0' },
    { type: 'next', at: 2_000 },
    { type: 'next', at: 3_000 },
  );
}

describe('the wager through the reducer', () => {
  test('only the last question of an opted-in round is played for stakes', () => {
    expect(isWagerQuestion(roomPlayingForStakes(true))).toBe(false);
    expect(isWagerQuestion(onTheLastQuestion(true))).toBe(true);
    expect(isWagerQuestion(onTheLastQuestion(false))).toBe(false);
  });

  test('a stake sent on an earlier question never reaches room state', () => {
    const early = apply(roomPlayingForStakes(true), {
      type: 'answer',
      uid: 'ann',
      optionIndex: 0,
      elapsedMs: 500,
      wager: 100,
    });
    expect(early.answers['ann']?.wager).toBeUndefined();
  });

  test('the board can double on the last question, and survive being skipped', () => {
    const last = onTheLastQuestion(true);
    const before = { ...last.scores };
    expect(before['ann']).toBe(1000);

    const played = apply(
      last,
      { type: 'answer', uid: 'ann', optionIndex: 0, elapsedMs: 1_000, wager: 100 },
      { type: 'answer', uid: 'bo', optionIndex: 3, elapsedMs: 1_500, wager: 100 },
      { type: 'reveal', correctIndex: 0, questionId: 'q1' },
    );

    // Ann had 1,000, staked all of it and was right: 500 + 500 + 1,000 on top.
    expect(played.scores['ann']).toBe(3000);
    // Bo had 900, staked all of it and was wrong. Nobody goes below nothing.
    expect(played.scores['bo']).toBe(0);

    // And the quizmaster throwing the question out puts the board back exactly.
    expect(apply(played, { type: 'skip' }).scores).toEqual(before);
  });

  test('a round that never opted in scores the last question as any other', () => {
    const played = apply(
      onTheLastQuestion(false),
      { type: 'answer', uid: 'ann', optionIndex: 0, elapsedMs: 1_000, wager: 100 },
      { type: 'reveal', correctIndex: 0, questionId: 'q1' },
    );
    expect(played.scores['ann']).toBe(2000);
  });
});

describe('a stake of nothing', () => {
  test('scores exactly as an answer with no stake at all', () => {
    const scores = { a: 1000, b: 1000 };
    const zero = tallyQuestion({ correctIndex: 1, answers: { a: at(100, 1, 0) }, scores });
    const absent = tallyQuestion({ correctIndex: 1, answers: { b: at(100, 1) }, scores });
    expect(zero['a']).toBe(absent['b']);
  });
});
