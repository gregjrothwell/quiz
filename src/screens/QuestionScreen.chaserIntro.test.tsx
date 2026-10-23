import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';
import { createRoom, type QuizQuestion } from '../engine/state';
import { CHASER_INTRO_MS, QuestionScreen } from './QuestionScreen';

/**
 * Beat the Chaser opens on the same title card as Share or Shaft. Everyone
 * on question one sees it, sticker included, for the first few seconds.
 */

afterEach(cleanup);

const noop = () => {};

const question: QuizQuestion = {
  id: 'q1',
  prompt: 'Which one is it?',
  options: ['A', 'B', 'C', 'D'],
  correctIndex: null,
  category: 'General',
  difficulty: 'easy',
};

function show(options: {
  chaser?: boolean;
  index?: number;
  elapsedMs?: number;
  revealed?: boolean;
  joinedMidQuestion?: boolean;
  today?: string;
  quizmaster?: boolean;
}) {
  const index = options.index ?? 0;
  const questions = index === 0 ? [question] : [question, { ...question, id: 'q2' }];
  return render(
    <QuestionScreen
      room={{
        ...createRoom('HKQ7'),
        phase: options.revealed ? 'reveal' : 'question',
        packId: 'sleeves',
        packTitle: 'Sleeves',
        chaserEnabled: options.chaser ?? true,
        index,
        questions,
        players: { greg: { name: 'Greg', joinedAt: 1 } },
        scores: { greg: 0 },
      }}
      youUid="greg"
      isQuizmaster={options.quizmaster ?? false}
      clock={{
        elapsedMs: options.elapsedMs ?? 0,
        remainingMs: 10_000,
        secondsLeft: 10,
        expired: false,
      }}
      revealed={options.revealed ?? false}
      joinedMidQuestion={options.joinedMidQuestion ?? false}
      onAnswer={noop}
      onReveal={noop}
      onNext={noop}
      onVote={noop}
      today={options.today ?? '2026-10-23'}
    />,
  );
}

describe('the Beat the Chaser title card', () => {
  test('introduces Mr Fries to a player at the start, sticker and all', () => {
    show({ today: '2026-11-05' });
    expect(screen.getByRole('heading', { name: /Against Mr Fries/ })).toBeInTheDocument();
    expect(screen.getByText(/whole office vs the house/i)).toBeInTheDocument();
    expect(screen.getByText('New')).toBeInTheDocument();
  });

  test('says the same thing on the quizmaster’s screen', () => {
    show({ quizmaster: true, today: '2026-10-23' });
    expect(screen.getByRole('heading', { name: /Against Mr Fries/ })).toBeInTheDocument();
  });

  test('drops the sticker the day after the mode’s window', () => {
    show({ today: '2026-11-06' });
    expect(screen.getByRole('heading', { name: /Against Mr Fries/ })).toBeInTheDocument();
    expect(screen.queryByText('New')).toBeNull();
  });

  test('leaves after a few seconds, and stays off the later questions', () => {
    show({ elapsedMs: CHASER_INTRO_MS });
    expect(screen.queryByRole('heading', { name: /Against Mr Fries/ })).toBeNull();

    cleanup();
    show({ elapsedMs: CHASER_INTRO_MS - 1 });
    expect(screen.getByRole('heading', { name: /Against Mr Fries/ })).toBeInTheDocument();

    cleanup();
    show({ index: 1, elapsedMs: 0 });
    expect(screen.queryByRole('heading', { name: /Against Mr Fries/ })).toBeNull();
  });

  test('is not there once the answer is out, or for someone who walked in late', () => {
    show({ revealed: true });
    expect(screen.queryByRole('heading', { name: /Against Mr Fries/ })).toBeNull();

    cleanup();
    show({ joinedMidQuestion: true });
    expect(screen.queryByRole('heading', { name: /Against Mr Fries/ })).toBeNull();
  });

  test('a round that is not against Mr Fries has no intro', () => {
    show({ chaser: false });
    expect(screen.queryByRole('heading', { name: /Against Mr Fries/ })).toBeNull();
    expect(screen.queryByText('New')).toBeNull();
  });
});
