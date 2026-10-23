import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';
import { createRoom, type QuizQuestion } from '../engine/state';
import { Scoreboard } from './Scoreboard';

/**
 * The round title card is the intro between questions. A new round wears the
 * same sticker there as on its lobby card.
 */

afterEach(cleanup);

const question = (id: string): QuizQuestion => ({
  id,
  prompt: 'Prompt',
  options: ['a', 'b', 'c', 'd'],
  correctIndex: null,
  category: 'General',
  difficulty: 'easy',
});

function show(packId: 'survey' | 'sleeves', today: string) {
  return render(
    <Scoreboard
      room={{
        ...createRoom('HKQ7'),
        phase: 'scoreboard',
        packId,
        packTitle: packId === 'survey' ? 'Survey Says' : 'Sleeves',
        questions: [question('a'), question('b')],
        players: { greg: { name: 'Greg', joinedAt: 1 } },
        scores: { greg: 0 },
      }}
      youUid="greg"
      isQuizmaster={false}
      onNext={() => {}}
      today={today}
    />,
  );
}

describe('the round title card', () => {
  test('stickers a new round', () => {
    show('survey', '2026-10-23');
    expect(screen.getByText('Survey Says')).toBeInTheDocument();
    expect(screen.getByText('New')).toBeInTheDocument();
  });

  test('leaves an older round alone', () => {
    show('sleeves', '2026-10-23');
    expect(screen.getByText('Sleeves')).toBeInTheDocument();
    expect(screen.queryByText('New')).toBeNull();
  });
});
