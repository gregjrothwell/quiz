import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';
import type { Phase } from '../engine/state';
import { Stage } from './Stage';

afterEach(cleanup);

const wipeOn = (mood?: Phase): boolean =>
  render(<Stage mood={mood}>content</Stage>).container.querySelector('.stage__wipe') !== null;

describe('the wipe between screens', () => {
  test('crosses each screen that is a new screen', () => {
    for (const mood of ['lobby', 'scoreboard', 'standoff', 'finished'] as const) {
      expect(wipeOn(mood)).toBe(true);
      cleanup();
    }
  });

  test('never crosses the question or the reveal', () => {
    // #then the clock and the drum roll keep the stage to themselves
    expect(wipeOn('question')).toBe(false);
    cleanup();
    expect(wipeOn('reveal')).toBe(false);
  });

  test('stays off every screen outside a room', () => {
    expect(wipeOn(undefined)).toBe(false);
  });

  test('crosses again when the screen changes', () => {
    // #given the standings
    const { container, rerender } = render(<Stage mood="scoreboard">content</Stage>);
    const first = container.querySelector('.stage__wipe');

    // #when the round moves on to the final
    rerender(<Stage mood="standoff">content</Stage>);

    // #then it is a fresh element, so its animation plays again
    const second = container.querySelector('.stage__wipe');
    expect(second).not.toBeNull();
    expect(second).not.toBe(first);
  });
});
