import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';
import { createRoom } from '../engine/state';
import type { StandoffView } from '../lib/useStandoff';
import { ShareOrShaft } from './ShareOrShaft';

/**
 * Share or Shaft's title card is the mode's intro. It wears the sticker for
 * the same fortnight as the lobby button.
 */

afterEach(cleanup);

const view: StandoffView = {
  lockedIn: { sam: false, greg: false },
  myPick: null,
  secondsLeft: 42,
  remainingMs: 42_000,
  pick: () => undefined,
};

function show(today: string) {
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
        },
        scores: { sam: 1000, greg: 800 },
        standoff: {
          finalists: ['sam', 'greg'],
          stakes: { sam: 1000, greg: 800 },
          stage: 'talk',
          sealed: null,
          picks: null,
        },
      }}
      youUid="greg"
      isQuizmaster={false}
      view={view}
      onOpenPicks={() => undefined}
      onNext={() => undefined}
      today={today}
    />,
  );
}

describe('the Share or Shaft title card', () => {
  test('stickers the mode through its last day', () => {
    show('2026-10-08');
    expect(screen.getByText('Share or Shaft')).toBeInTheDocument();
    expect(screen.getByText('New')).toBeInTheDocument();
  });

  test('drops the sticker the day after', () => {
    show('2026-10-09');
    expect(screen.getByText('Share or Shaft')).toBeInTheDocument();
    expect(screen.queryByText('New')).toBeNull();
  });
});
