import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { ColdOpen } from './ColdOpen';

/**
 * The opening titles wait. Nothing on this card starts the round: the
 * quizmaster's Start the round is the only advance, and a long wait does not
 * press it. That is the behaviour since 31c04ed.
 */

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const players = {
  greg: { name: 'Greg', joinedAt: 1 },
  sam: { name: 'Sam', joinedAt: 2 },
};

describe('the opening titles', () => {
  test('wait for the quizmaster, and do not start the round themselves', () => {
    vi.useFakeTimers();
    const onStart = vi.fn();
    const onBack = vi.fn();
    render(
      <ColdOpen
        facts={[{ id: 'champion', uids: ['greg'], wins: 4 }]}
        players={players}
        isQuizmaster
        onStart={onStart}
        onBack={onBack}
      />,
    );

    expect(screen.getByText('Defending champion')).toBeInTheDocument();
    expect(screen.getByText('Greg — 4 wins this season')).toBeInTheDocument();
    vi.advanceTimersByTime(10_000);
    expect(onStart).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Start the round' }));
    expect(onStart).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  test('tells everyone else to wait', () => {
    render(
      <ColdOpen
        facts={[{ id: 'newcomers', uids: ['sam'] }]}
        players={players}
        isQuizmaster={false}
        onStart={() => undefined}
        onBack={() => undefined}
      />,
    );

    expect(screen.getByText('Waiting for the quizmaster to start the round…')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  test('says nothing when everyone it would name has left', () => {
    // The buttons live on the card. With nobody left to name, the card is gone
    // and so is Start the round — the lobby underneath is what the room sees.
    const { container } = render(
      <ColdOpen
        facts={[{ id: 'champion', uids: ['gone'], wins: 2 }]}
        players={players}
        isQuizmaster
        onStart={() => undefined}
        onBack={() => undefined}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
