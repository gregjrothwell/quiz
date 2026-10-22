import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createRoom, type RoomState } from '../engine/state';
import type * as Sound from '../lib/sound';
import type { FinalSnapshot } from '../lib/useFinalSnapshot';
import { Final } from './Final';

/**
 * The podium after the whistle: what its caption says, and what it plays while
 * it builds. Each test has its own game id, because a podium this page has
 * already built is shown rather than staged again.
 */

const useCue = vi.hoisted(() => vi.fn());
vi.mock('../lib/sound', async (original) => ({
  ...(await original<typeof Sound>()),
  useCue,
}));

beforeEach(() => {
  useCue.mockClear();
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

const noop = () => {};

const ANN = { name: 'Ann', joinedAt: 1 };
const BOB = { name: 'Bob', joinedAt: 2 };
const SCORES = { ann: 5_000, bob: 3_000 };
const NEWCOMER = { played: 0, wins: 0, best: 0 };

/** Ann won and Bob came second; `live` is who is still in the room. */
function podium(gameId: string, live: RoomState['players']) {
  const room: RoomState = {
    ...createRoom('HKQ7'),
    phase: 'finished',
    gameId,
    players: live,
    scores: SCORES,
    history: { ann: NEWCOMER, bob: NEWCOMER },
  };
  const snapshot: FinalSnapshot = { gameId, players: { ann: ANN, bob: BOB }, scores: SCORES };
  return (
    <Final
      room={room}
      snapshot={snapshot}
      banked={null}
      youPlayerId="bob"
      youUid="bob"
      isQuizmaster={false}
      log={[]}
      onPlayAgain={noop}
      onLeave={noop}
      onSeason={noop}
    />
  );
}

/**
 * Past the build: the winner's riser has landed. A tenth of a second at a time,
 * so each beat of the build renders — one long jump would batch them into one.
 */
function landed(): void {
  for (let ms = 0; ms < 5_000; ms += 100) {
    act(() => {
      vi.advanceTimersByTime(100);
    });
  }
}

const played = (cue: string): boolean => useCue.mock.calls.some(([name, , enabled]) => name === cue && enabled === true);

describe('the podium caption', () => {
  test('names the winner the podium shows, with everybody still there', () => {
    // #given the final screen, nobody gone
    const { container } = render(podium('caption-all', { ann: ANN, bob: BOB }));

    // #when the build lands
    landed();

    // #then the caption is Ann's
    expect(container.querySelector('.commentary')).toHaveTextContent('Ann');
  });

  test('still names that winner after they have pressed Leave', () => {
    // #given the final screen, and Ann — the winner — has gone home
    const { container } = render(podium('caption-gone', { bob: BOB }));

    // #when the build lands
    landed();

    // #then the caption follows the table frozen at the whistle, as the
    // risers and the heading do, rather than crowning Bob
    expect(container.querySelector('h1')).toHaveTextContent('Ann');
    expect(container.querySelector('.commentary')).toHaveTextContent('Ann');
    expect(container.querySelector('.commentary')).not.toHaveTextContent('Bob');
  });
});

describe('the podium build', () => {
  test('rolls the drum under the hold, then plays the fanfare on the landing', () => {
    // #given a podium seen for the first time
    render(podium('build', { ann: ANN, bob: BOB }));

    // #when it builds and lands
    landed();

    // #then both play, the roll first
    expect(played('roll')).toBe(true);
    expect(played('fanfare')).toBe(true);
    const first = (cue: string): number => useCue.mock.calls.findIndex(([name, , enabled]) => name === cue && enabled === true);
    expect(first('roll')).toBeLessThan(first('fanfare'));
  });
});
