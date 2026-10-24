import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { createRoom } from '../engine/state';
import type { PackSummary } from '../questions/types';
import { Lobby } from './Lobby';

/**
 * Geekend keep their own question history, and the quizmaster says which room
 * this is. The choice reaches the deal as the last thing `onStart` is handed.
 */

afterEach(cleanup);

const noop = () => {};

const sleeves: PackSummary = {
  id: 'sleeves',
  title: 'Sleeves',
  blurb: 'A round',
  count: 40,
  counts: { easy: 10, medium: 20, hard: 10 },
};

function show(squad: string, onStart = vi.fn()) {
  render(
    <Lobby
      room={{ ...createRoom('HKQ7'), players: { greg: { name: 'Greg', joinedAt: 1 } } }}
      youUid="greg"
      isQuizmaster
      packs={[sleeves]}
      busy={false}
      squad={squad}
      onVote={noop}
      onStart={onStart}
      onLeave={noop}
      notice={{ unseen: false, teaser: null }}
      today="2026-10-24"
    />,
  );
  return onStart;
}

/** Where `history` sits in `onStart`'s arguments: tenth, before `doubleEnabled`. */
const HISTORY = 9;

async function start() {
  await userEvent.click(screen.getByRole('button', { name: /Sleeves/ }));
  await userEvent.click(screen.getByRole('button', { name: 'Start the show' }));
}

describe('whose questions', () => {
  test('an office quizmaster deals from the office history', async () => {
    const onStart = show('Hermes');
    expect(screen.getByRole('button', { name: /^The office/ })).toHaveAttribute('aria-pressed', 'true');
    await start();
    expect(onStart.mock.calls[0]?.[HISTORY]).toBe('office');
  });

  test('a Geekend quizmaster starts on Geekend', async () => {
    const onStart = show('Geekend');
    expect(screen.getByRole('button', { name: /^Geekend/ })).toHaveAttribute('aria-pressed', 'true');
    await start();
    expect(onStart.mock.calls[0]?.[HISTORY]).toBe('geekend');
  });

  test('either can be switched, so a Geekend quizmaster can still host the office', async () => {
    const onStart = show('Geekend');
    await userEvent.click(screen.getByRole('button', { name: /^The office/ }));
    await start();
    expect(onStart.mock.calls[0]?.[HISTORY]).toBe('office');
  });
});
