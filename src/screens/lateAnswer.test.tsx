import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { LOST_LINE } from '../engine/scoring';
import { createRoom, type RoomState } from '../engine/state';
import { QuestionScreen } from './QuestionScreen';
import { Scoreboard } from './Scoreboard';

/**
 * An answer that missed the cut-off.
 *
 * The fold does not have it, so the player holds it beside the published
 * picks and `verdictFor` says `lost`. Two things used to hide that: the amber
 * line waited for the replay to settle, so a quick Next took the screen away
 * first, and the replay landed their own chip, which looks like a counted
 * answer. docs/decisions/cass-q1.md.
 */

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const noop = () => {};

const CLOCK = { elapsedMs: 10_000, remainingMs: 0, secondsLeft: 0, expired: true };

function lateRoom(phase: 'reveal' | 'scoreboard'): RoomState {
  return {
    ...createRoom('HKQ7'),
    phase,
    packId: 'uk-leaning',
    packTitle: 'Best of British',
    players: {
      greg: { name: 'Greg', joinedAt: 1 },
      sam: { name: 'Sam', joinedAt: 2 },
      priya: { name: 'Priya', joinedAt: 3 },
    },
    questions: [
      {
        id: 'q1',
        prompt: 'Which one is it?',
        options: ['The right one', 'The wrong one', 'Another', 'The last'],
        correctIndex: 0,
        category: 'Film',
        difficulty: 'easy',
      },
    ],
    answers: {
      sam: { optionIndex: 1, elapsedMs: 2_300 },
      priya: { optionIndex: 0, elapsedMs: 4_100 },
      greg: { optionIndex: 1, elapsedMs: 9_850 },
    },
    lastPicks: {
      sam: { optionIndex: 1, elapsedMs: 2_300 },
      priya: { optionIndex: 0, elapsedMs: 4_100 },
    },
    lastDeltas: { sam: 0, priya: 1_000 },
  };
}

function showReveal() {
  return render(
    <QuestionScreen
      room={lateRoom('reveal')}
      youUid="greg"
      isQuizmaster={false}
      clock={CLOCK}
      revealed
      onAnswer={noop}
      onReveal={noop}
      onNext={noop}
      onVote={noop}
    />,
  );
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

describe('an answer that missed the cut-off', () => {
  test('says so on the reveal before the replay has settled', () => {
    // #given the reveal, and a clock that has not been allowed to run the replay
    vi.useFakeTimers();
    const { container } = showReveal();

    // #then the amber line is already up, which is the whole of a quick Next
    const verdict = container.querySelector('.verdict');
    expect(verdict?.classList.contains('verdict--in')).toBe(true);
    expect(verdict?.getAttribute('data-tone')).toBe('lost');
    expect(verdict?.textContent).toContain(LOST_LINE);
  });

  test('does not land their chip, and does not paint the lectern as a scored wrong', () => {
    // #given reduced motion, so every counted chip is on screen at once
    reducedMotion();
    const { container } = showReveal();

    // #then the people the fold counted are on the lecterns
    const names = [...container.querySelectorAll('.tile__name')].map((node) => node.textContent);
    expect(names).toEqual(expect.arrayContaining(['Sam', 'Priya']));
    // #and the late answer is not among them
    expect(names).not.toContain('Greg');

    // #and their own lectern is not the red of a scored wrong answer
    const own = [...container.querySelectorAll('.tile')].find((tile) => tile.textContent?.includes('The wrong one'));
    expect(own?.className).not.toContain('tile--wrong');
    expect(container.querySelector('.verdict')?.textContent).toContain(LOST_LINE);
  });

  test('keeps the line on the standings, which is where Next goes', () => {
    // #given the room after Next: same late answer, same tally, now the scoreboard
    render(
      <Scoreboard
        room={lateRoom('scoreboard')}
        youUid="greg"
        isQuizmaster={false}
        onNext={noop}
      />,
    );

    // #then the line is still there
    expect(screen.getByRole('status').textContent).toContain(LOST_LINE);
  });

  test('says nothing on the standings to someone the fold counted', () => {
    // #given the same room, seen by a player who is in the tally
    render(
      <Scoreboard
        room={lateRoom('scoreboard')}
        youUid="priya"
        isQuizmaster={false}
        onNext={noop}
      />,
    );

    // #then no lost line. The message is only for the answer that missed.
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByText(LOST_LINE)).toBeNull();
  });
});
