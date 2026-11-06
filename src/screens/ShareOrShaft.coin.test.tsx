import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';
import { createRoom } from '../engine/state';
import type { Standoff, StandoffStage } from '../engine/standoff';
import type { StandoffView } from '../lib/useStandoff';
import { ShareOrShaft } from './ShareOrShaft';

/** A tie at the cut is decided by a coin, and the room is told so until the reveal. */

afterEach(cleanup);

const view: StandoffView = {
  lockedIn: { sam: false, greg: false },
  myPick: null,
  secondsLeft: 42,
  remainingMs: 42_000,
  pick: () => undefined,
};

const LINE = 'Greg and Priya tied on 800. The coin picked Greg.';

function show(
  stage: StandoffStage,
  scores: Record<string, number>,
  extra: { double?: { scores: Record<string, number> }; youUid?: string } = {},
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

describe('the coin line', () => {
  test.each(['talk', 'pick', 'closed'] as const)('says so during %s', (stage) => {
    show(stage, { sam: 1000, greg: 800, priya: 800 });
    expect(screen.getByText(LINE)).toBeTruthy();
  });

  test('speaks to the one it left out', () => {
    show('talk', { sam: 1000, greg: 800, priya: 800 }, { youUid: 'priya' });
    expect(screen.getByText('You and Greg tied on 800. The coin picked Greg.')).toBeTruthy();
  });

  test('gone by the reveal', () => {
    show('revealed', { sam: 900, greg: 900, priya: 800 });
    expect(screen.queryByText(/The coin picked/)).toBeNull();
  });

  test('absent without a tie', () => {
    show('talk', { sam: 1000, greg: 800, priya: 700 });
    expect(screen.queryByText(/The coin picked/)).toBeNull();
  });

  test('reads the morning in The Double, which is what chose them', () => {
    // Level on the round alone, but not on the morning.
    show('talk', { sam: 1000, greg: 800, priya: 800 }, { double: { scores: { sam: 0, greg: 500, priya: 0 } } });
    expect(screen.queryByText(/The coin picked/)).toBeNull();
  });
});
