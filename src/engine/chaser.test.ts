import { describe, expect, test } from 'vitest';
import { FALLBACK_RATE, chaserScore, friesPick, rateFor, ratesFrom, roomTakes, type Rates } from './chaser';
import { reduce } from './reducer';
import { createRoom, type QuizQuestion, type RoomState } from './state';

const RATES: Rates = {
  overall: { hits: 620, tries: 1000 },
  byDifficulty: { easy: { hits: 77, tries: 100 }, hard: { hits: 50, tries: 100 }, medium: { hits: 5, tries: 10 } },
  byPack: { screens: { easy: { hits: 86, tries: 100 }, hard: { hits: 1, tries: 2 } } },
};

describe('rateFor', () => {
  test('pack × difficulty when the group is big enough', () => {
    expect(rateFor(RATES, 'screens', 'easy')).toBeCloseTo(0.86);
  });

  test('falls back to the difficulty, then overall, when a group is thin', () => {
    expect(rateFor(RATES, 'screens', 'hard')).toBeCloseTo(0.5);
    expect(rateFor(RATES, 'screens', 'medium')).toBeCloseTo(0.62);
    expect(rateFor(RATES, 'sleeves', 'easy')).toBeCloseTo(0.77);
  });

  test('with no rates file at all, the office average', () => {
    expect(rateFor(null, 'screens', 'easy')).toBe(FALLBACK_RATE);
  });
});

describe('friesPick', () => {
  test('C2: over 10,000 questions at 64% he is right 64% ± 1.5%', () => {
    let right = 0;
    for (let i = 0; i < 10_000; i += 1) {
      if (friesPick('game-7', `q${String(i)}`, 0.64, i % 4, 4) === i % 4) right += 1;
    }
    expect(right / 10_000).toBeGreaterThan(0.625);
    expect(right / 10_000).toBeLessThan(0.655);
  });

  test('wrong picks are spread over the wrong options, never the right one', () => {
    const counts = [0, 0, 0, 0];
    for (let i = 0; i < 4_000; i += 1) counts[friesPick('g', `q${String(i)}`, 0, 1, 4)]! += 1;
    expect(counts[1]).toBe(0);
    for (const option of [0, 2, 3]) expect(counts[option]!).toBeGreaterThan(1_100);
  });

  test('the same game and question give the same pick on every device', () => {
    expect(friesPick('g', 'q1', 0.5, 2, 4)).toBe(friesPick('g', 'q1', 0.5, 2, 4));
  });
});

describe('roomTakes', () => {
  const a = (optionIndex: number) => ({ optionIndex, elapsedMs: 1_000 });

  test('more than half right takes it; exactly half does not', () => {
    expect(roomTakes({ x: a(0), y: a(0), z: a(1) }, 0)).toBe(true);
    expect(roomTakes({ x: a(0), y: a(1) }, 0)).toBe(false);
  });

  test('nobody answering is nobody\'s question', () => {
    expect(roomTakes({}, 0)).toBe(false);
  });
});

describe('chaserScore', () => {
  test('counts only revealed questions he played', () => {
    const base = { prompt: '', options: ['a', 'b'], category: '', difficulty: 'easy' as const };
    const questions: QuizQuestion[] = [
      { ...base, id: '1', correctIndex: 0, chaser: { pick: 0, roomTook: true } },
      { ...base, id: '2', correctIndex: 1, chaser: { pick: 0, roomTook: true } },
      { ...base, id: '3', correctIndex: 1, chaser: { pick: 1, roomTook: false } },
      { ...base, id: '4', correctIndex: null },
    ];
    expect(chaserScore(questions)).toEqual({ room: 2, fries: 2 });
  });
});

describe('the reveal', () => {
  function playing(chaserEnabled: boolean): RoomState {
    const question: QuizQuestion = {
      id: 'q0',
      prompt: 'p',
      options: ['a', 'b', 'c', 'd'],
      correctIndex: null,
      category: 'c',
      difficulty: 'easy',
      ...(chaserEnabled ? { chaserRate: 0.7 } : {}),
    };
    let room: RoomState = { ...createRoom('ABCD'), players: { x: { name: 'X', joinedAt: 1 }, y: { name: 'Y', joinedAt: 2 } } };
    room = reduce(room, {
      type: 'selectPack',
      packId: 'general-knowledge',
      packTitle: 'GK',
      questions: [question],
      wagerEnabled: false,
      stealEnabled: false,
      chaserEnabled,
    });
    room = reduce(room, { type: 'start', at: 0, gameId: 'g1', durationSecs: 10 });
    room = reduce(room, { type: 'answer', uid: 'x', optionIndex: 2, elapsedMs: 1_000 });
    return reduce(room, { type: 'answer', uid: 'y', optionIndex: 2, elapsedMs: 2_000 });
  }

  test('stamps Mr Fries\'s pick and the room\'s verdict when he is playing', () => {
    const revealed = reduce(playing(true), { type: 'reveal', correctIndex: 2, questionId: 'q0' });
    expect(revealed.questions[0]?.chaser).toEqual({ pick: friesPick('g1', 'q0', 0.7, 2, 4), roomTook: true });
  });

  test('stamps nothing when he is not, so the room is as it always was', () => {
    const revealed = reduce(playing(false), { type: 'reveal', correctIndex: 2, questionId: 'q0' });
    expect(revealed.questions[0]?.chaser).toBeUndefined();
    expect(revealed.chaserEnabled).toBe(false);
  });
});

describe('ratesFrom', () => {
  test('reads a rates file and refuses anything else', () => {
    expect(ratesFrom(RATES)).toEqual(RATES);
    expect(ratesFrom({ overall: { hits: 1 } })).toBeNull();
    expect(ratesFrom(null)).toBeNull();
  });
});
