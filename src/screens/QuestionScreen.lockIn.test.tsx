import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { createRoom, type QuizQuestion, type RoomState } from '../engine/state';
import type { QuestionClock } from '../lib/useQuestionClock';
import { AUTO_LOCK_MS, QuestionScreen } from './QuestionScreen';

/**
 * Lock it in (PROJ-78, docs/decisions/lock-in.md): a pick is local and free, a
 * lock is the one write and is final, and an unlocked pick locks itself near
 * the end, ranked from the full window.
 */

afterEach(cleanup);

const noop = () => {};

const QUESTION: QuizQuestion = {
  id: 'q1',
  prompt: 'Which is the capital of Wales?',
  options: ['Cardiff', 'Swansea', 'Newport', 'Bangor'],
  correctIndex: null,
  category: 'Geography',
  difficulty: 'easy',
};

function room(answers: RoomState['answers'] = {}): RoomState {
  return {
    ...createRoom('LK1N'),
    phase: 'question',
    packId: 'general-knowledge',
    packTitle: 'General Knowledge',
    durationSecs: 10,
    index: 0,
    players: { greg: { name: 'Greg', joinedAt: 100 } },
    questions: [QUESTION],
    answers,
  };
}

function at(elapsedMs: number): QuestionClock {
  const remainingMs = Math.max(0, 10_000 - elapsedMs);
  return { elapsedMs, remainingMs, secondsLeft: Math.ceil(remainingMs / 1000), expired: remainingMs === 0 };
}

function screen(state: RoomState, clock: QuestionClock, onAnswer: (...args: unknown[]) => void) {
  return (
    <QuestionScreen
      room={state}
      youUid="greg"
      isQuizmaster={false}
      clock={clock}
      revealed={false}
      joinedMidQuestion={false}
      onAnswer={onAnswer}
      onReveal={noop}
      onNext={noop}
      onVote={noop}
    />
  );
}

const tiles = (container: HTMLElement): HTMLButtonElement[] => [
  ...container.querySelectorAll<HTMLButtonElement>('button.tile'),
];

describe('lock it in', () => {
  test('a pick writes nothing, and can be moved', () => {
    const onAnswer = vi.fn();
    const { container } = render(screen(room(), at(1_000), onAnswer));

    fireEvent.keyDown(window, { key: 'a' });
    fireEvent.keyDown(window, { key: 'b' });
    const third = tiles(container)[2];
    if (third) fireEvent.click(third);

    expect(onAnswer).not.toHaveBeenCalled();
    expect(tiles(container).map((tile) => tile.className)).toEqual(['tile', 'tile', 'tile tile--held', 'tile']);
    expect(container.textContent).toMatch(/Tap it again, or press Enter, to lock it in/);
  });

  test('Enter locks the pick in', () => {
    const onAnswer = vi.fn();
    render(screen(room(), at(1_000), onAnswer));

    fireEvent.keyDown(window, { key: 'b' });
    fireEvent.keyDown(window, { key: 'Enter' });

    expect(onAnswer).toHaveBeenCalledTimes(1);
    expect(onAnswer).toHaveBeenCalledWith(1, undefined);
  });

  test('a tap on the lectern already picked locks it in', () => {
    const onAnswer = vi.fn();
    const { container } = render(screen(room(), at(1_000), onAnswer));
    const first = tiles(container)[0];
    if (first) {
      fireEvent.click(first);
      expect(onAnswer).not.toHaveBeenCalled();
      fireEvent.click(first);
    }
    expect(onAnswer).toHaveBeenCalledTimes(1);
    expect(onAnswer).toHaveBeenCalledWith(0, undefined);
  });

  test('a held key repeats a pick and never locks it', () => {
    const onAnswer = vi.fn();
    render(screen(room(), at(1_000), onAnswer));
    for (let i = 0; i < 5; i += 1) fireEvent.keyDown(window, { key: 'a', repeat: i > 0 });
    expect(onAnswer).not.toHaveBeenCalled();
  });

  test('Enter with nothing picked does nothing', () => {
    const onAnswer = vi.fn();
    render(screen(room(), at(1_000), onAnswer));
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onAnswer).not.toHaveBeenCalled();
  });

  test('Enter on a focused lectern is that lectern, not a second lock', () => {
    const onAnswer = vi.fn();
    const { container } = render(screen(room(), at(1_000), onAnswer));
    fireEvent.keyDown(window, { key: 'a' });
    const second = tiles(container)[1];
    if (second) fireEvent.keyDown(second, { key: 'Enter' });
    expect(onAnswer).not.toHaveBeenCalled();
  });

  test('a locked answer is final: lecterns and keys shut, and it says so', () => {
    const onAnswer = vi.fn();
    const { container } = render(screen(room({ greg: { optionIndex: 1, elapsedMs: 2_000 } }), at(3_000), onAnswer));

    expect(tiles(container).every((tile) => tile.disabled)).toBe(true);
    expect(tiles(container)[1]?.className).toBe('tile tile--picked');
    expect(container.textContent).toMatch(/Locked in/);

    fireEvent.keyDown(window, { key: 'c' });
    fireEvent.keyDown(window, { key: 'Enter' });
    const third = tiles(container)[2];
    if (third) fireEvent.click(third);
    expect(onAnswer).not.toHaveBeenCalled();
  });

  test(`an unlocked pick locks itself with ${String(AUTO_LOCK_MS)}ms left, ranked from the full window`, () => {
    const onAnswer = vi.fn();
    const state = room();
    const { rerender } = render(screen(state, at(5_000), onAnswer));
    fireEvent.keyDown(window, { key: 'd' });

    rerender(screen(state, at(10_000 - AUTO_LOCK_MS - 100), onAnswer));
    expect(onAnswer).not.toHaveBeenCalled();

    rerender(screen(state, at(10_000 - AUTO_LOCK_MS), onAnswer));
    expect(onAnswer).toHaveBeenCalledTimes(1);
    expect(onAnswer).toHaveBeenCalledWith(3, undefined, true);

    // Once, not on every tick after.
    rerender(screen(state, at(10_000 - AUTO_LOCK_MS + 100), onAnswer));
    expect(onAnswer).toHaveBeenCalledTimes(1);
  });

  test('no pick, no auto-lock', () => {
    const onAnswer = vi.fn();
    render(screen(room(), at(9_500), onAnswer));
    expect(onAnswer).not.toHaveBeenCalled();
  });
});
