import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createRoom, type QuizQuestion, type RoomState } from '../engine/state';
import type { Banked } from '../lib/season';
import type * as Sound from '../lib/sound';
import { Final } from './Final';
import { Scoreboard } from './Scoreboard';

/**
 * One ending, told once. docs/decisions/round-end.md.
 */

const { cue } = vi.hoisted(() => ({ cue: vi.fn() }));

vi.mock('../lib/sound', async (importOriginal) => ({
  ...(await importOriginal<typeof Sound>()),
  useCue: cue,
}));

beforeEach(() => {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  cue.mockClear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const noop = () => {};
const PLAYERS = { ann: { name: 'Ann', joinedAt: 1 }, bob: { name: 'Bob', joinedAt: 2 } };
const BANKED: Banked = { season: 'season-2', week: 'week-2026-W45', squad: '', rivalsCaption: null };

function room(gameId: string, overrides: Partial<RoomState> = {}): RoomState {
  return {
    ...createRoom('HKQ7'),
    phase: 'finished',
    gameId,
    packTitle: 'Science',
    players: PLAYERS,
    scores: { ann: 5_000, bob: 3_000 },
    history: { ann: { played: 3, wins: 1, best: 9_000 }, bob: { played: 3, wins: 1, best: 9_000 } },
    ...overrides,
  };
}

function final(state: RoomState, isQuizmaster = true, banked: Banked | null = null) {
  return render(
    <Final
      room={state}
      snapshot={null}
      banked={banked}
      youPlayerId="ann"
      youUid="ann"
      isQuizmaster={isQuizmaster}
      log={[]}
      onPlayAgain={noop}
      onLeave={noop}
      onSeason={noop}
    />,
  );
}

const cueOn = (name: string) => cue.mock.calls.some(([cueName, , on]) => cueName === name && on === true);
const FIRST_HALF = { doubleEnabled: true, double: null };
const SECOND_HALF = { doubleEnabled: true, double: { gameId: 'first', scores: { ann: 1_000, bob: 6_000 } } };

describe('half-time', () => {
  test('is the table and the way on: no podium, no chair, no card, no season table', () => {
    const { container } = final(room('half-bare', FIRST_HALF));
    expect(container.querySelector('h1')).toHaveTextContent('Ann leads at half-time');
    expect(container.querySelector('.finale')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Share the result' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Season table' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Second half' }).closest('.transport')).not.toBeNull();
  });

  test('plays no fanfare and no drum roll, and the commentator does not call it a win', () => {
    const { container } = final(room('half-quiet', FIRST_HALF));
    expect(cueOn('fanfare')).toBe(false);
    expect(cueOn('roll')).toBe(false);
    expect(container.querySelector('.commentary')).toBeNull();
  });

  test('a player is told what they are waiting for, and can still leave', () => {
    final(room('half-player', FIRST_HALF), false);
    expect(screen.getByText(/start the second half/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Leave' })).toBeInTheDocument();
  });

  test('an ordinary finish still has its podium: half-time is not every finish', () => {
    const { container } = final(room('ordinary'));
    expect(container.querySelector('.finale')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Share the result' })).toBeInTheDocument();
  });
});

describe('after a final', () => {
  const settled = (gameId: string): RoomState =>
    room(gameId, {
      standoff: {
        finalists: ['ann', 'bob'],
        stakes: { ann: 4_000, bob: 4_000 },
        stage: 'revealed',
        sealed: ['ann', 'bob'],
        picks: { ann: 'share', bob: 'share' },
      },
    });

  test('the podium has already landed: no second drum roll, the host can move on at once', () => {
    final(settled('after-final'));
    expect(cueOn('roll')).toBe(false);
    expect(cueOn('fanfare')).toBe(true);
    expect(screen.getByRole('button', { name: 'Another round' })).toBeInTheDocument();
  });

  test('with no final the build still holds the winner back', () => {
    final(room('no-final'));
    expect(screen.queryByRole('button', { name: 'Another round' })).toBeNull();
  });
});

describe('below the podium', () => {
  test('a double has one table, and it ranks the total', () => {
    const { container } = final(room('one-table', SECOND_HALF));
    expect(container.querySelectorAll('.double-table')).toHaveLength(1);
    expect(container.querySelector('.double-table tbody th')).toHaveTextContent('Bob');
    expect(container.querySelector('.standings')).toBeNull();
    expect(screen.getByText('Second half')).toBeInTheDocument();
  });

  test('after a final the second half column says the final is in it', () => {
    const standoff: RoomState['standoff'] = {
      finalists: ['ann', 'bob'],
      stakes: { ann: 6_000, bob: 9_000 },
      stage: 'revealed',
      sealed: ['ann', 'bob'],
      picks: { ann: 'share', bob: 'share' },
    };
    final(room('labelled', { ...SECOND_HALF, standoff }));
    expect(screen.getByText('Second half + final')).toBeInTheDocument();
  });

  test('the eyebrow names The Double, not the second half’s pack', () => {
    const { container } = final(room('eyebrow', SECOND_HALF));
    expect(container.querySelector('.eyebrow')).toHaveTextContent('The Double');
  });

  test('says it has gone onto the season table only once it has', () => {
    const { rerender } = final(room('banked'), false, null);
    expect(screen.queryByText(/gone onto the season table/)).toBeNull();
    rerender(
      <Final
        room={room('banked')}
        snapshot={null}
        banked={BANKED}
        youPlayerId="ann"
        youUid="ann"
        isQuizmaster={false}
        log={[]}
        onPlayAgain={noop}
        onLeave={noop}
        onSeason={noop}
      />,
    );
    expect(screen.getByText(/gone onto the season table/)).toBeInTheDocument();
  });
});

describe('the last scoreboard, which is now only ever reached before a final or after a skip', () => {
  const question = (id: string) =>
    ({ id, prompt: id, options: ['a', 'b'], correctIndex: 0, difficulty: 'easy' }) as QuizQuestion;

  function board(overrides: Partial<RoomState>) {
    render(
      <Scoreboard
        room={room('board', { phase: 'scoreboard', questions: [question('q1')], ...overrides })}
        youUid="ann"
        isQuizmaster
        onNext={noop}
      />,
    );
    return screen.getByRole('button', { name: /Share or Shaft|Half-time|Final results/ }).textContent;
  }

  test('offers the final only when one will be played', () => {
    expect(board({ standoffEnabled: true })).toBe('To Share or Shaft');
  });

  test('says half-time on the first half, even with Share or Shaft on (the bug: it promised the final)', () => {
    expect(board({ ...FIRST_HALF, standoffEnabled: true })).toBe('Half-time');
  });

  test('says final results with nothing more to play', () => {
    expect(board({})).toBe('Final results');
  });

  test('a question is called a question: "Round Two" also meant the second half', () => {
    render(
      <Scoreboard
        room={room('card', { phase: 'scoreboard', questions: [question('q1'), question('q2')] })}
        youUid="ann"
        isQuizmaster
        onNext={noop}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Question Two' })).toBeInTheDocument();
  });
});
