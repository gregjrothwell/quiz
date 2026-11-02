import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { createRoom, type RoomState } from '../engine/state';
import { QuestionScreen } from './QuestionScreen';

/**
 * A pick nobody locked in is locked for them with 2s left and stamped at the
 * full window (docs/decisions/lock-in.md). On the reveal that read "10.0s", which
 * the office took for a broken clock on 2 November 2026: 22 of 99 answers in
 * Theme Tunes E3JM. It says what happened instead.
 */

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const noop = () => {};

function room(): RoomState {
  return {
    ...createRoom('NL0K'),
    phase: 'reveal',
    packId: 'general-knowledge',
    packTitle: 'General Knowledge',
    durationSecs: 10,
    players: {
      sam: { name: 'Sam', joinedAt: 1 },
      priya: { name: 'Priya', joinedAt: 2 },
    },
    questions: [
      {
        id: 'q1',
        prompt: 'Which one is it?',
        options: ['The right one', 'The wrong one', 'Another', 'The last'],
        correctIndex: 0,
        category: 'General Knowledge',
        difficulty: 'easy',
      },
    ],
    answers: {
      sam: { optionIndex: 0, elapsedMs: 2_300 },
      priya: { optionIndex: 0, elapsedMs: 10_000 },
    },
    lastPicks: {
      sam: { optionIndex: 0, elapsedMs: 2_300 },
      priya: { optionIndex: 0, elapsedMs: 10_000 },
    },
    lastDeltas: { sam: 1_000, priya: 900 },
  };
}

function reducedMotion(): void {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({
        matches: query.includes('reduce'),
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList,
  );
}

describe('an answer that was never locked in', () => {
  test('reads "not locked" on the reveal, and a locked one keeps its time', () => {
    // #given reduced motion, so every chip is on screen at once
    reducedMotion();
    const { container } = render(
      <QuestionScreen
        room={room()}
        youUid="sam"
        isQuizmaster={false}
        clock={{ elapsedMs: 10_000, remainingMs: 0, secondsLeft: 0, expired: true }}
        revealed
        onAnswer={noop}
        onReveal={noop}
        onNext={noop}
        onVote={noop}
      />,
    );

    // #then each chip says what happened
    const chips = Object.fromEntries(
      [...container.querySelectorAll('.tile__pick')].map((chip) => [
        chip.querySelector('.tile__name')?.textContent,
        chip.querySelector('i')?.textContent,
      ]),
    );
    expect(chips).toEqual({ Sam: '2.3s', Priya: 'not locked' });
  });
});
