import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';
import { createRoom, type QuizQuestion, type RoomState } from '../engine/state';
import type { PackId } from '../questions/types';
import type { QuestionClock } from '../lib/useQuestionClock';
import { Lobby } from './Lobby';
import { QuestionScreen } from './QuestionScreen';

/**
 * TMDB's API terms make the licence conditional on attribution, for every
 * user: the TMDB logo, and a notice placed prominently in the app. Fetched
 * 15 October 2026; the live site had neither. W1 of the productionisation
 * plan — docs/decisions/public-scale.md#the-plan-15-october-2026.
 *
 * The still's credit follows the pack the question *behaves as*, so an On the
 * box still dealt into a Random Round carries it and a Fine Art one does not.
 */

afterEach(cleanup);

const noop = () => {};

const STILL: QuizQuestion = {
  id: 'still-1',
  prompt: 'Which film is this?',
  options: ['Option one', 'Option two', 'Option three', 'Option four'],
  correctIndex: null,
  category: 'Film',
  difficulty: 'easy',
  image: 'a'.repeat(64) + '.jpg',
  imageWidth: 780,
  imageHeight: 439,
};

function room(packId: PackId, question: QuizQuestion): RoomState {
  return {
    ...createRoom('HKQ7'),
    phase: 'question',
    packId,
    packTitle: 'On the box',
    durationSecs: 15,
    gameId: 'game-1',
    players: { greg: { name: 'Greg', joinedAt: 100 } },
    questions: [question],
    index: 0,
  };
}

const CLOCK: QuestionClock = { elapsedMs: 1_000, remainingMs: 14_000, secondsLeft: 14, expired: false };

function show(packId: PackId, question: QuizQuestion = STILL) {
  return render(
    <QuestionScreen
      room={room(packId, question)}
      youUid="greg"
      isQuizmaster={false}
      clock={CLOCK}
      revealed={false}
      joinedMidQuestion={false}
      onAnswer={noop}
      onReveal={noop}
      onNext={noop}
      onVote={noop}
    />,
  );
}

describe('the TMDB credit on a still', () => {
  test('an On the box still carries the TMDB logo', () => {
    show('screens');
    expect(screen.getByRole('img', { name: 'TMDB' })).toBeInTheDocument();
  });

  test('a Fine Art still does not', () => {
    show('picture');
    expect(screen.queryByRole('img', { name: 'TMDB' })).toBeNull();
  });

  test('an On the box still dealt into a Random Round still carries it', () => {
    show('random', { ...STILL, sourcePack: 'screens' });
    expect(screen.getByRole('img', { name: 'TMDB' })).toBeInTheDocument();
  });

  test('a Fine Art still dealt into a Random Round does not', () => {
    show('random', { ...STILL, sourcePack: 'picture' });
    expect(screen.queryByRole('img', { name: 'TMDB' })).toBeNull();
  });
});

describe('the TMDB notice in the lobby', () => {
  test('the lobby carries the logo and the notice the terms ask for, in their words', () => {
    render(
      <Lobby
        room={{ ...createRoom('HKQ7'), players: { greg: { name: 'Greg', joinedAt: 1 } } }}
        youUid="greg"
        isQuizmaster={false}
        packs={[]}
        busy={false}
        onVote={noop}
        onStart={noop}
        onLeave={noop}
      />,
    );
    expect(screen.getByRole('img', { name: 'TMDB' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'This website uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB.',
      ),
    ).toBeInTheDocument();
  });
});
