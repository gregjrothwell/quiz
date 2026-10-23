import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';
import { createRoom, type QuizQuestion } from '../engine/state';
import { QuestionScreen } from './QuestionScreen';

/**
 * The card used to sit on question one while its clock ran. It now has its
 * own screen, before the question opens, so a chaser question is a question.
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

describe('a question against Mr Fries', () => {
  test('has no title card on it, so the clock is the whole window', () => {
    render(
      <QuestionScreen
        room={{
          ...createRoom('HKQ7'),
          phase: 'question',
          packId: 'sleeves',
          packTitle: 'Sleeves',
          chaserEnabled: true,
          index: 0,
          questions: [question],
          players: { greg: { name: 'Greg', joinedAt: 1 } },
          scores: { greg: 0 },
          questionOpenedAt: 1_000,
          durationSecs: 10,
        }}
        youUid="greg"
        isQuizmaster={false}
        clock={{ elapsedMs: 0, remainingMs: 10_000, secondsLeft: 10, expired: false }}
        revealed={false}
        onAnswer={noop}
        onReveal={noop}
        onNext={noop}
        onVote={noop}
      />,
    );
    expect(screen.queryByRole('heading', { name: /Against Mr Fries/ })).toBeNull();
    expect(screen.getByRole('timer', { name: '10 seconds remaining' })).toBeInTheDocument();
  });
});
