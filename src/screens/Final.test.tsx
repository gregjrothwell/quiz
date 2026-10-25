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

/**
 * The Double on the final screen (docs/decisions/morning-double.md, AC3 and
 * AC12). Round one ends at half-time; round two ends on the whole morning.
 */
describe('the Double', () => {
  /** Ann topped round two; Bob tops the morning, 9,000 to 7,000. */
  const FIRST = { ann: 2_000, bob: 6_000 };

  function doubleFinal(
    gameId: string,
    double: RoomState['double'],
    isQuizmaster: boolean,
  ) {
    const room: RoomState = {
      ...createRoom('HKQ7'),
      phase: 'finished',
      gameId,
      players: { ann: ANN, bob: BOB },
      scores: SCORES,
      history: { ann: NEWCOMER, bob: NEWCOMER },
      doubleEnabled: true,
      double,
    };
    const snapshot: FinalSnapshot = { gameId, players: { ann: ANN, bob: BOB }, scores: SCORES };
    return (
      <Final
        room={room}
        snapshot={snapshot}
        banked={null}
        youPlayerId="bob"
        youUid="bob"
        isQuizmaster={isQuizmaster}
        log={[]}
        onPlayAgain={noop}
        onLeave={noop}
        onSeason={noop}
      />
    );
  }

  test('round one ends at half-time, and the quizmaster is offered round two', () => {
    const { container, getByRole, queryByRole } = render(doubleFinal('half-quizmaster', null, true));
    landed();
    expect(container).toHaveTextContent(/Half-time/);
    expect(getByRole('button', { name: 'Second half' })).toBeInTheDocument();
    expect(queryByRole('button', { name: 'Another round' })).toBeNull();
  });

  test('everybody else is told round two is coming', () => {
    const { container } = render(doubleFinal('half-player', null, false));
    landed();
    expect(container).toHaveTextContent(/second half/i);
  });

  test('round two crowns the top of the morning, not of the round', () => {
    const { container } = render(doubleFinal('double-end', { gameId: 'round-one', scores: FIRST }, false));
    landed();
    expect(container.querySelector('h1')).toHaveTextContent('Bob');
    expect(container).toHaveTextContent(/wins The Double/);
  });

  test('shows each player’s two rounds and the morning', () => {
    const { container } = render(doubleFinal('double-rows', { gameId: 'round-one', scores: FIRST }, false));
    landed();
    // Bob: 6,000 then 3,000, 9,000 on the morning. Ann: 2,000 then 5,000, 7,000.
    for (const figure of ['6,000', '3,000', '9,000', '2,000', '5,000', '7,000']) {
      expect(container).toHaveTextContent(figure);
    }
  });

  test('after round two the quizmaster is offered an ordinary round again', () => {
    const { getByRole } = render(doubleFinal('double-again', { gameId: 'round-one', scores: FIRST }, true));
    landed();
    expect(getByRole('button', { name: 'Another round' })).toBeInTheDocument();
  });
});
