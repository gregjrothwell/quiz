import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { Landing } from './Landing';

/**
 * "Start a new room" is disabled until there is a name, and a disabled button
 * with no reason given reads as a broken one — the hint under it says why.
 */

function landing() {
  return render(
    <Landing
      busy={false}
      error={null}
      onCreate={vi.fn()}
      onJoin={vi.fn()}
      onSeason={vi.fn()}
      onUpdates={vi.fn()}
    />,
  );
}

describe('Landing — Run the show', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('with no name, the disabled Start button says what it is waiting for', () => {
    landing();
    const start = screen.getByRole('button', { name: 'Start a new room' });
    expect(start).toBeDisabled();
    expect(start).toHaveAccessibleDescription(/your name/i);
  });

  test('once there is a name, the button is live and the hint is the usual one', () => {
    landing();
    fireEvent.change(screen.getByPlaceholderText('e.g. Greg'), { target: { value: 'Priya' } });
    const start = screen.getByRole('button', { name: 'Start a new room' });
    expect(start).toBeEnabled();
    expect(start).toHaveAccessibleDescription(/everyone else joins with your code/i);
  });
});
