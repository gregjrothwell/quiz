import { describe, expect, test } from 'vitest';
import type { SealedQuestion } from '../questions/types';
import { awardsFor } from './awards';
import { reduce, type Action } from './reducer';
import { createRoom, currentQuestion, type Answer, type QuizQuestion, type RoomState } from './state';
import {
  dealSurveyRound,
  guessReveal,
  isPickCorrect,
  isTell,
  SURVEY_MIN_ANSWERS,
  SURVEY_PROMPTS_PER_ROUND,
  tallyTell,
  topOf,
} from './survey';

function prompt(id: string): SealedQuestion {
  return {
    id,
    question: `Prompt ${id}`,
    options: ['A', 'B', 'C', 'D'],
    category: 'Survey Says',
    difficulty: 'medium',
  };
}

const PROMPTS = Array.from({ length: 12 }, (_, i) => prompt(`p${i}`));

/** A fixed sequence, so a deal is the same every run. */
function seeded(): () => number {
  let state = 7;
  return () => {
    state = (state * 16807) % 2147483647;
    return state / 2147483647;
  };
}

function picks(...options: number[]): Record<string, Answer> {
  return Object.fromEntries(options.map((optionIndex, i) => [`u${i}`, { optionIndex, elapsedMs: 1_000 + i }]));
}

describe('dealSurveyRound', () => {
  test('five prompts, told then guessed: ten questions', () => {
    const round = dealSurveyRound(PROMPTS, seeded());
    expect(round).toHaveLength(SURVEY_PROMPTS_PER_ROUND * 2);
    expect(round.slice(0, 5).every((question) => question.survey?.part === 'tell')).toBe(true);
    expect(round.slice(5).every((question) => question.survey?.part === 'guess')).toBe(true);
  });

  test('every prompt told is guessed once, and the ids never collide', () => {
    const round = dealSurveyRound(PROMPTS, seeded());
    const told = round.slice(0, 5).map((question) => question.survey?.promptId).sort();
    const guessed = round.slice(5).map((question) => question.survey?.promptId).sort();
    expect(guessed).toEqual(told);
    expect(new Set(round.map((question) => question.id)).size).toBe(10);
  });

  test('the options keep their written order in both parts, so a tally means the same option', () => {
    const round = dealSurveyRound(PROMPTS, seeded());
    for (const question of round) expect(question.options).toEqual(['A', 'B', 'C', 'D']);
  });

  test('the guesses come back in a different order from the telling', () => {
    const round = dealSurveyRound(PROMPTS, seeded());
    const told = round.slice(0, 5).map((question) => question.survey?.promptId);
    const guessed = round.slice(5).map((question) => question.survey?.promptId);
    expect(guessed).not.toEqual(told);
  });

  test('prompts the season has served are dealt last', () => {
    const asked = new Set(PROMPTS.slice(0, 10).map((entry) => entry.id));
    const round = dealSurveyRound(PROMPTS, seeded(), asked);
    const told = round.slice(0, 5).map((question) => question.survey?.promptId ?? '');
    expect(told).toEqual(expect.arrayContaining(['p10', 'p11']));
  });

  test('no answer exists before the reveal, as on every pack', () => {
    for (const question of dealSurveyRound(PROMPTS, seeded())) expect(question.correctIndex).toBeNull();
  });
});

describe('tallyTell and topOf', () => {
  test('counts each option', () => {
    expect(tallyTell(picks(0, 1, 1, 3, 1), 4)).toEqual([1, 3, 0, 1]);
  });

  test('the most picked option is the top', () => {
    expect(topOf([1, 3, 0, 1])).toEqual([1]);
  });

  test('a tie for top makes every tied option the top', () => {
    expect(topOf([3, 3, 1, 0])).toEqual([0, 1]);
  });

  test(`fewer than ${SURVEY_MIN_ANSWERS} answers is not a survey`, () => {
    expect(topOf([1, 1, 0, 0])).toBeNull();
    expect(topOf([0, 3, 0, 0])).toEqual([1]);
  });
});

describe('isPickCorrect', () => {
  const plain = { correctIndex: 2 } as const;
  const tied = { correctIndex: 0, survey: { part: 'guess' as const, promptId: 'p1', top: [0, 3] } };

  test('an ordinary question has one right answer', () => {
    expect(isPickCorrect(plain, 2)).toBe(true);
    expect(isPickCorrect(plain, 1)).toBe(false);
  });

  test('a tied survey answer is right on every tied option', () => {
    expect(isPickCorrect(tied, 0)).toBe(true);
    expect(isPickCorrect(tied, 3)).toBe(true);
    expect(isPickCorrect(tied, 1)).toBe(false);
  });

  test('a tell question has no right answer', () => {
    const tell = { correctIndex: 0, survey: { part: 'tell' as const, promptId: 'p1' } };
    expect(isTell(tell)).toBe(true);
    expect(isPickCorrect(tell, 0)).toBe(false);
  });
});

describe('guessReveal', () => {
  const round: QuizQuestion[] = dealSurveyRound(PROMPTS, seeded());
  const guessIndex = 5;
  const promptId = round[guessIndex]?.survey?.promptId ?? '';
  const tellIndex = round.findIndex(
    (question) => question.survey?.part === 'tell' && question.survey.promptId === promptId,
  );

  test('reads the room’s top answer off the told question in the log', () => {
    const log = [{ index: tellIndex, answers: picks(2, 2, 1, 2) }];
    expect(guessReveal(round, guessIndex, log)).toEqual({ correctIndex: 2, top: [2] });
  });

  test('a tie reveals every tied option, the lowest as correctIndex', () => {
    const log = [{ index: tellIndex, answers: picks(3, 1, 3, 1) }];
    expect(guessReveal(round, guessIndex, log)).toEqual({ correctIndex: 1, top: [1, 3] });
  });

  test('no record of the telling — a host who took over mid-round — reveals nothing', () => {
    expect(guessReveal(round, guessIndex, [])).toBeNull();
  });

  test('too few answers reveals nothing', () => {
    const log = [{ index: tellIndex, answers: picks(2, 2) }];
    expect(guessReveal(round, guessIndex, log)).toBeNull();
  });
});

describe('a survey round through the reducer', () => {
  function started(): RoomState {
    return [
      { type: 'join', uid: 'ann', name: 'Ann', at: 100 },
      { type: 'join', uid: 'bo', name: 'Bo', at: 200 },
      { type: 'join', uid: 'cy', name: 'Cy', at: 300 },
      {
        type: 'selectPack',
        packId: 'survey',
        packTitle: 'Survey Says',
        questions: dealSurveyRound(PROMPTS, seeded()),
        wagerEnabled: false,
        stealEnabled: false,
      },
      { type: 'start', at: 1_000, gameId: 'game-s', durationSecs: 10 },
    ].reduce<RoomState>((state, action) => reduce(state, action as Action), createRoom('SRV1'));
  }

  test('a tell scores nobody and publishes nobody’s pick (T2, T3)', () => {
    const state = started();
    const question = currentQuestion(state);
    const after = [
      { type: 'answer', uid: 'ann', optionIndex: 0, elapsedMs: 900 },
      { type: 'answer', uid: 'bo', optionIndex: 1, elapsedMs: 800 },
      { type: 'reveal', correctIndex: 0, questionId: question?.id ?? '' },
    ].reduce<RoomState>((s, action) => reduce(s, action as Action), state);

    expect(after.phase).toBe('reveal');
    expect(after.scores).toEqual({ ann: 0, bo: 0, cy: 0 });
    expect(after.lastDeltas).toEqual({});
    expect(after.lastPicks).toEqual({});
  });

  test('a guess with a tied top pays everyone on a tied option (G1)', () => {
    let state = started();
    // Through the five tells to the first guess: reveal, scoreboard, next question.
    for (let i = 0; i < SURVEY_PROMPTS_PER_ROUND; i += 1) {
      state = reduce(state, { type: 'reveal', correctIndex: 0, questionId: currentQuestion(state)?.id ?? '' });
      state = reduce(reduce(state, { type: 'next', at: 2_000 + i }), { type: 'next', at: 2_500 + i });
    }
    const guess = currentQuestion(state);
    expect(guess?.survey?.part).toBe('guess');

    state = [
      { type: 'answer', uid: 'ann', optionIndex: 1, elapsedMs: 900 },
      { type: 'answer', uid: 'bo', optionIndex: 3, elapsedMs: 800 },
      { type: 'answer', uid: 'cy', optionIndex: 2, elapsedMs: 700 },
      { type: 'reveal', correctIndex: 1, questionId: guess?.id ?? '', top: [1, 3] },
    ].reduce<RoomState>((s, action) => reduce(s, action as Action), state);

    expect(state.lastDeltas['ann']).toBeGreaterThan(0);
    expect(state.lastDeltas['bo']).toBeGreaterThan(0);
    expect(state.lastDeltas['cy']).toBe(0);
    expect(currentQuestion(state)?.survey?.top).toEqual([1, 3]);
  });

  test('a top naming an option that does not exist is refused', () => {
    let state = started();
    for (let i = 0; i < SURVEY_PROMPTS_PER_ROUND; i += 1) {
      state = reduce(state, { type: 'reveal', correctIndex: 0, questionId: currentQuestion(state)?.id ?? '' });
      state = reduce(reduce(state, { type: 'next', at: 2_000 + i }), { type: 'next', at: 2_500 + i });
    }
    const guess = currentQuestion(state);
    const after = reduce(state, { type: 'reveal', correctIndex: 1, questionId: guess?.id ?? '', top: [1, 9] });
    expect(after).toBe(state);
  });
});

describe('awards in a survey round', () => {
  test('a tell counts for no award, so devices holding different picks agree', () => {
    // The host holds everyone's tell; a member holds only their own. Both must
    // name the same fastest finger.
    const guess = { index: 5, correctIndex: 1, answers: picks(1, 2, 1), deltas: { u0: 1_000, u1: 0, u2: 900 } };
    const hostLog = [{ index: 0, correctIndex: 0, tell: true, answers: picks(0, 0, 0), deltas: {} }, guess];
    const memberLog = [{ index: 0, correctIndex: 0, tell: true, answers: { u0: { optionIndex: 0, elapsedMs: 1 } }, deltas: {} }, guess];
    expect(awardsFor(hostLog, ['u0', 'u1', 'u2'])).toEqual(awardsFor(memberLog, ['u0', 'u1', 'u2']));
  });

  test('a tied top counts as right for the awards too', () => {
    const tied = { index: 5, correctIndex: 1, top: [1, 3], answers: picks(3, 2, 2), deltas: { u0: 1_000, u1: 0, u2: 0 } };
    const fastest = awardsFor([tied], ['u0', 'u1', 'u2']).find((award) => award.id === 'fastest');
    expect(fastest?.uids).toEqual(['u0']);
  });
});
