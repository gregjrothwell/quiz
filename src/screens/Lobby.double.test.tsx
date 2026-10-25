import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { createRoom, type RoomState } from '../engine/state';
import type { PackId, PackSummary } from '../questions/types';
import { Lobby } from './Lobby';

/**
 * The Double in the lobby: a choice for round one, locked on for round two.
 * docs/decisions/morning-double.md, AC1 and AC2.
 */

afterEach(cleanup);

const noop = () => {};

function pack(id: PackId, title: string): PackSummary {
  return { id, title, blurb: '', count: 100, counts: { easy: 30, medium: 40, hard: 30 } };
}

const PACKS = [pack('science', 'Science')];
const PLAYERS = { greg: { name: 'Greg', joinedAt: 1 }, priya: { name: 'Priya', joinedAt: 2 } };

const ROUND_ONE: RoomState = { ...createRoom('HKQ7'), players: PLAYERS };
const ROUND_TWO: RoomState = {
  ...ROUND_ONE,
  doubleEnabled: true,
  double: { gameId: 'round-one', scores: { greg: 6_000, priya: 3_000 } },
};

function lobby(room: RoomState, isQuizmaster: boolean, onStart = vi.fn()) {
  render(
    <Lobby
      room={room}
      youUid="greg"
      isQuizmaster={isQuizmaster}
      packs={PACKS}
      busy={false}
      onVote={noop}
      onStart={onStart}
      onLeave={noop}
    />,
  );
  return onStart;
}

const doubleChoice = () => screen.queryByRole('button', { name: /^The Double/ });

/** The last argument `onStart` was called with: whether the round is a double. */
function startedAsDouble(onStart: ReturnType<typeof vi.fn>): unknown {
  const call = onStart.mock.calls.at(-1) ?? [];
  return call.at(-1);
}

describe('the Double in the lobby', () => {
  test('the quizmaster can choose it, and it starts off', () => {
    lobby(ROUND_ONE, true);
    expect(doubleChoice()).toHaveAttribute('aria-pressed', 'false');
  });

  test('choosing it starts the round as a double', () => {
    const onStart = lobby(ROUND_ONE, true);
    fireEvent.click(screen.getByRole('button', { name: /Science/ }));
    fireEvent.click(doubleChoice() as HTMLElement);
    fireEvent.click(screen.getByRole('button', { name: 'Start the show' }));
    expect(startedAsDouble(onStart)).toBe(true);
  });

  test('left alone, the round is not a double', () => {
    const onStart = lobby(ROUND_ONE, true);
    fireEvent.click(screen.getByRole('button', { name: /Science/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Start the show' }));
    expect(startedAsDouble(onStart)).toBe(false);
  });

  test('like every option, only the quizmaster sees the choice', () => {
    lobby(ROUND_ONE, false);
    expect(doubleChoice()).toBeNull();
  });

  test("in round two's lobby it shows on and cannot be turned off", () => {
    const onStart = lobby(ROUND_TWO, true);
    const choice = doubleChoice();
    expect(choice).toHaveAttribute('aria-pressed', 'true');
    expect(choice).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /Science/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Start the show' }));
    expect(startedAsDouble(onStart)).toBe(true);
  });

  test('everyone can see it is round two of the Double', () => {
    lobby(ROUND_TWO, false);
    expect(screen.getByText(/second half of The Double/)).toBeInTheDocument();
  });

  test('round one says nothing about a round two', () => {
    lobby(ROUND_ONE, false);
    expect(screen.queryByText(/second half of The Double/)).toBeNull();
  });
});
