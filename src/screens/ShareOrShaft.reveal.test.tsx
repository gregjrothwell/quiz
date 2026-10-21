import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createRoom, type RoomState } from '../engine/state';
import type { StandoffView } from '../lib/useStandoff';
import { ShareOrShaft } from './ShareOrShaft';

/**
 * The quizmaster's Space during the reveal. One press used to take the whole
 * room to the final results in the middle of the sequence; now the first press
 * only jumps this screen to the result, and the second moves everybody on.
 */

afterEach(cleanup);
beforeEach(() => {
  vi.useFakeTimers();
  return () => vi.useRealTimers();
});

/** Sam shafted Greg; Priya, third, is watching and running the room. */
const ROOM: RoomState = {
  ...createRoom('HKQ7'),
  phase: 'standoff',
  gameId: 'reveal-test',
  standoffEnabled: true,
  players: {
    sam: { name: 'Sam', joinedAt: 1 },
    greg: { name: 'Greg', joinedAt: 2 },
    priya: { name: 'Priya', joinedAt: 3 },
  },
  scores: { sam: 5_550, greg: 0, priya: 1_800 },
  lastDeltas: { sam: 2_450, greg: -2_450 },
  standoff: {
    finalists: ['sam', 'greg'],
    stakes: { sam: 3_100, greg: 2_450 },
    stage: 'revealed',
    sealed: ['sam', 'greg'],
    picks: { sam: 'shaft', greg: 'share' },
  },
};

const VIEW: StandoffView = {
  lockedIn: { sam: true, greg: true },
  myPick: null,
  secondsLeft: 0,
  remainingMs: 0,
  pick: () => undefined,
};

function show(onNext: () => void) {
  render(
    <ShareOrShaft room={ROOM} youUid="priya" isQuizmaster view={VIEW} onOpenPicks={() => undefined} onNext={onNext} />,
  );
}

const space = (): void => {
  act(() => {
    fireEvent.keyDown(window, { key: ' ' });
  });
};

const headline = (): HTMLElement | null => screen.queryByText(/takes all 5,550/);

describe('Space during the reveal', () => {
  test('the first press jumps to the result and moves nobody on', () => {
    // #given the reveal just started — picks turning over, no words yet
    const onNext = vi.fn();
    show(onNext);
    expect(headline()).toBeNull();

    // #when the quizmaster presses Space
    space();

    // #then this screen has the result, and the room is still on the reveal
    expect(headline()).not.toBeNull();
    expect(onNext).not.toHaveBeenCalled();

    // #and the second press is the one that moves everybody on
    space();
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  test('a timer still pending after the jump does not drag the screen back', () => {
    const onNext = vi.fn();
    show(onNext);
    space();

    // #when the clash and impact timers fire after the cut
    act(() => {
      vi.advanceTimersByTime(1_500);
    });

    // #then the result is still on screen
    expect(headline()).not.toBeNull();
  });

  test('once the reveal has played out, one press moves on as it always did', () => {
    const onNext = vi.fn();
    show(onNext);

    // #given the whole sequence played
    act(() => {
      vi.advanceTimersByTime(3_000);
    });
    expect(headline()).not.toBeNull();

    // #then a single press is enough
    space();
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});
