import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';
import { createRoom, type RoomState } from '../engine/state';
import type { Standoff, StandoffStage } from '../engine/standoff';
import type { StandoffView } from '../lib/useStandoff';
import { ShareOrShaft } from './ShareOrShaft';

/** The room is told how a tie at the cut was settled, until the reveal. */

afterEach(cleanup);

const view: StandoffView = {
  lockedIn: { sam: false, greg: false },
  myPick: null,
  secondsLeft: 42,
  remainingMs: 42_000,
  pick: () => undefined,
};

const RIGHT = { greg: { right: 8, ms: 39_800 }, priya: { right: 7, ms: 25_300 } };
const LINE = 'Greg and Priya tied on 800. Greg got more right, 8 to 7.';

function show(
  stage: StandoffStage,
  scores: Record<string, number>,
  extra: {
    double?: { scores: Record<string, number>; rightAnswers?: RoomState['rightAnswers'] };
    youUid?: string;
  } = {},
) {
  const standoff: Standoff = {
    finalists: ['sam', 'greg'],
    stakes: { sam: 1000, greg: 800 },
    stage,
    sealed: stage === 'pick' || stage === 'talk' ? null : ['sam', 'greg'],
    picks: stage === 'revealed' ? { sam: 'share', greg: 'share' } : null,
  };
  return render(
    <ShareOrShaft
      room={{
        ...createRoom('HKQ7'),
        phase: 'standoff',
        gameId: 'tonight',
        standoffEnabled: true,
        players: {
          sam: { name: 'Sam', joinedAt: 1 },
          greg: { name: 'Greg', joinedAt: 2 },
          priya: { name: 'Priya', joinedAt: 3 },
        },
        scores,
        rightAnswers: RIGHT,
        standoff,
        ...(extra.double ? { double: { gameId: 'round-one', ...extra.double } } : {}),
      }}
      youUid={extra.youUid ?? 'sam'}
      isQuizmaster={false}
      view={view}
      settledReveal
      onOpenPicks={() => undefined}
      onNext={() => undefined}
    />,
  );
}

describe('the tie line', () => {
  test.each(['talk', 'pick', 'closed'] as const)('says so during %s', (stage) => {
    show(stage, { sam: 1000, greg: 800, priya: 800 });
    expect(screen.getByText(LINE)).toBeTruthy();
  });

  test('speaks to the one it left out', () => {
    show('talk', { sam: 1000, greg: 800, priya: 800 }, { youUid: 'priya' });
    expect(screen.getByText('You and Greg tied on 800. Greg got more right, 8 to 7.')).toBeTruthy();
  });

  test('gone by the reveal', () => {
    show('revealed', { sam: 900, greg: 900, priya: 800 });
    expect(screen.queryByText(/tied on/)).toBeNull();
  });

  test('absent without a tie', () => {
    show('talk', { sam: 1000, greg: 800, priya: 700 });
    expect(screen.queryByText(/tied on/)).toBeNull();
  });

  test('reads the morning in The Double, which is what chose them', () => {
    // Level on the round alone, but not on the morning.
    show('talk', { sam: 1000, greg: 800, priya: 800 }, { double: { scores: { sam: 0, greg: 500, priya: 0 } } });
    expect(screen.queryByText(/tied on/)).toBeNull();
  });
});

test('adds round one in The Double, which is what chose them', () => {
  // Round two alone says 8 to 7. Round one's three take Greg to 11.
  show(
    'talk',
    { sam: 1000, greg: 800, priya: 300 },
    { double: { scores: { sam: 0, greg: 0, priya: 500 }, rightAnswers: { greg: { right: 3, ms: 9_000 } } } },
  );
  expect(screen.getByText('Greg and Priya tied on 800. Greg got more right, 11 to 7.')).toBeTruthy();
});
