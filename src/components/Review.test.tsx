import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';
import type { QuizQuestion } from '../engine/state';
import { Review } from './Review';

/**
 * The panel under the rosettes. Greg, 27 October 2026: the title is
 * "A question nobody got". What it quotes has to be every answer that was right.
 */

afterEach(cleanup);

function question(overrides: Partial<QuizQuestion> = {}): QuizQuestion {
  return {
    id: 'q1',
    prompt: 'Which one?',
    options: ['Alpha', 'Beta', 'Gamma', 'Delta'],
    correctIndex: 1,
    category: 'General',
    difficulty: 'easy',
    ...overrides,
  };
}

describe('the question nobody got', () => {
  test('quotes the one answer on an ordinary question', () => {
    render(
      <Review
        review={[{ id: 'stumper', index: 0, attempts: 4 }]}
        questions={[question()]}
      />,
    );

    expect(screen.getByText('A question nobody got')).toBeInTheDocument();
    expect(screen.getByText('Which one?')).toBeInTheDocument();
    expect(screen.getByText('The answer was Beta. 4 answers, not one of them right.')).toBeInTheDocument();
  });

  test('quotes every option that tied on a Survey Says guess', () => {
    // #given a guess whose top two options both counted as right
    render(
      <Review
        review={[{ id: 'stumper', index: 0, attempts: 3 }]}
        questions={[
          question({
            correctIndex: 1,
            survey: { part: 'guess', promptId: 'p1', top: [1, 3] },
          }),
        ]}
      />,
    );

    // #then the card does not call Beta the only answer — Delta was right too
    expect(
      screen.getByText('The answers were Beta and Delta. 3 answers, not one of them right.'),
    ).toBeInTheDocument();
  });

  test('quotes three tied options without dropping one', () => {
    render(
      <Review
        review={[{ id: 'stumper', index: 0, attempts: 3 }]}
        questions={[
          question({
            correctIndex: 0,
            survey: { part: 'guess', promptId: 'p1', top: [0, 1, 2] },
          }),
        ]}
      />,
    );

    expect(
      screen.getByText('The answers were Alpha, Beta and Gamma. 3 answers, not one of them right.'),
    ).toBeInTheDocument();
  });

  test('a clean sweep does not give the answer away again', () => {
    render(
      <Review review={[{ id: 'sweep', index: 0, attempts: 4 }]} questions={[question()]} />,
    );

    expect(screen.getByText('Nobody missed it')).toBeInTheDocument();
    expect(screen.getByText('All 4 of you had this one.')).toBeInTheDocument();
    expect(screen.queryByText(/The answer was/)).toBeNull();
  });
});
