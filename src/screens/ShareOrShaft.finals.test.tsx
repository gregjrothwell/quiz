import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { FinalsTally } from '../engine/finals';
import { createRoom, type RoomState } from '../engine/state';
import type { StandoffView } from '../lib/useStandoff';
import { ShareOrShaft } from './ShareOrShaft';

/**
 * The line on the seats. Coming in from the talk through the whistle, hidden
 * while the reveal is still moving, and back with tonight added once the
 * seats settle.
 */

afterEach(cleanup);
beforeEach(() => {
  vi.useFakeTimers();
  return () => vi.useRealTimers();
});

const COMING: Record<string, FinalsTally> = {
  sam: { finals: 7, shared: 5, shafted: 2, gotShafted: 2 },
  greg: { finals: 4, shared: 2, shafted: 2, gotShafted: 1 },
};

const VIEW: StandoffView = {
  lockedIn: { sam: false, greg: false },
  myPick: null,
  secondsLeft: 42,
  remainingMs: 42_000,
  pick: () => undefined,
};

function room(overrides: Partial<RoomState> = {}): RoomState {
  return {
    ...createRoom('HKQ7'),
    phase: 'standoff',
    gameId: 'tonight',
    standoffEnabled: true,
    players: {
      sam: { name: 'Sam', joinedAt: 1 },
      greg: { name: 'Greg', joinedAt: 2 },
      priya: { name: 'Priya', joinedAt: 3 },
    },
    scores: { sam: 3_100, greg: 2_450, priya: 1_800 },
    standoff: {
      finalists: ['sam', 'greg'],
      stakes: { sam: 3_100, greg: 2_450 },
      stage: 'talk',
      sealed: null,
      picks: null,
    },
    ...overrides,
  };
}

function show(state: RoomState, records: Record<string, FinalsTally> | null, settledReveal = false) {
  render(
    <ShareOrShaft
      room={state}
      youUid="priya"
      isQuizmaster={false}
      view={VIEW}
      records={records}
      settledReveal={settledReveal}
      onOpenPicks={() => undefined}
      onNext={() => undefined}
    />,
  );
}

const SAM_COMING = '7 finals · shared 5 · shafted 2 · got shafted 2';
const SAM_TONIGHT = '8 finals · shared 5 · shafted 3 · got shafted 2';

describe('the finals line on the seat', () => {
  test('shows the record coming in while they talk, and First final for none', () => {
    show(room(), {
      ...COMING,
      greg: { finals: 0, shared: 0, shafted: 0, gotShafted: 0 },
    });

    expect(screen.getByText(SAM_COMING)).toBeInTheDocument();
    expect(screen.getByText('First final')).toBeInTheDocument();
  });

  test('shows nothing when the read has not come back', () => {
    show(room(), null);
    expect(screen.queryByText(SAM_COMING)).toBeNull();
    expect(screen.queryByText('First final')).toBeNull();
  });

  test('hides the line through the clash, then shows tonight added', () => {
    // #given the reveal just opened, Sam having shafted and Greg having shared
    show(room({
      scores: { sam: 5_550, greg: 0, priya: 1_800 },
      lastDeltas: { sam: 2_450, greg: -2_450 },
      standoff: {
        finalists: ['sam', 'greg'],
        stakes: { sam: 3_100, greg: 2_450 },
        stage: 'revealed',
        sealed: ['sam', 'greg'],
        picks: { sam: 'shaft', greg: 'share' },
      },
    }), COMING);

    // #then the line is off the seats while they are still moving
    expect(screen.queryByText(SAM_COMING)).toBeNull();
    expect(screen.queryByText(SAM_TONIGHT)).toBeNull();

    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(screen.queryByText(SAM_TONIGHT)).toBeNull();

    // #when the seats settle
    act(() => {
      vi.advanceTimersByTime(2_000);
    });

    // #then tonight is on the line: Sam's shaft, and Greg was shafted
    expect(screen.getByText(SAM_TONIGHT)).toBeInTheDocument();
    expect(screen.getByText('5 finals · shared 3 · shafted 2 · got shafted 2')).toBeInTheDocument();
  });

  test('a settled no-pick says no pick, not share', () => {
    show(room({
      standoff: {
        finalists: ['sam', 'greg'],
        stakes: { sam: 3_100, greg: 2_450 },
        stage: 'revealed',
        sealed: ['sam'],
        picks: { sam: 'shaft', greg: null },
      },
    }), {
      sam: { finals: 7, shared: 5, shafted: 2, gotShafted: 2 },
      greg: { finals: 3, shared: 2, shafted: 1, gotShafted: 0 },
    }, true);

    expect(screen.getByText('No pick')).toBeInTheDocument();
    expect(screen.getByText('4 finals · shared 2 · shafted 1 · got shafted 1 · no pick 1')).toBeInTheDocument();
    expect(screen.queryByText(/shared 3/)).toBeNull();
  });
});
